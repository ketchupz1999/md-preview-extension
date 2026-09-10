import DOMPurify from 'dompurify';
import { findFile, isImage, resolveLocalPath } from './files.js';
import { LocalURLFile } from './file-url.js';
import { localFileReference } from './file-url-policy.js';
import { headingSlug } from './markdown.js';

export const HTML_PREVIEW_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src blob:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
export const isHTML = (path) => /\.html?$/i.test(path);

/** 将本地 HTML 准备为隔离的静态页面，不执行文档脚本或加载远程资源。 */
export async function prepareHTML(source, { path, fileURL = '', root = null }, signal) {
  const urls = [], assets = new Map();
  let resourceCount = 0, totalBytes = 0, skipped = 0;
  const dispose = () => urls.forEach((url) => URL.revokeObjectURL(url));
  signal.addEventListener('abort', dispose, { once: true });
  const document = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true, RETURN_DOM: true,
    ADD_TAGS: ['link'],
    FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'portal', 'audio', 'video', 'foreignObject', 'animate', 'animateMotion', 'animateTransform', 'set'],
    FORBID_ATTR: ['srcdoc', 'srcset', 'poster', 'action', 'formaction', 'ping', 'target', 'autofocus', 'autoplay', 'is'],
  });

  async function resource(reference, from, type) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const local = fileURL ? localFileReference(from, reference) : resolveLocalPath(from, reference);
    const target = local?.url || local?.path;
    if (!target || (type === 'css' ? !/\.css$/i.test(target) : !isImage(target))) { skipped++; return null; }
    const key = `${type}:${target}`;
    if (assets.has(key)) return assets.get(key);
    if (++resourceCount > 40) { skipped++; return null; }
    try {
      const handle = fileURL ? new LocalURLFile(target) : await findFile(root, target);
      const file = await handle.getFile();
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (file.size > (type === 'css' ? 2 : 20) * 1024 * 1024 || totalBytes + file.size > 32 * 1024 * 1024) { skipped++; return null; }
      totalBytes += file.size;
      let result;
      if (type === 'css') result = { text: await file.text(), path: target };
      else {
        const url = URL.createObjectURL(file);
        urls.push(url); result = url;
      }
      assets.set(key, result);
      return result;
    } catch (error) {
      if (signal.aborted) throw error;
      skipped++; return null;
    }
  }

  async function localCSS(css, from) {
    // 不引入其他样式表；无法识别的 URL 写法仍受 iframe 的严格 CSP 限制。
    css = css.replace(/@import\s+(?:url\([^;]*?\)|"[^"]*"|'[^']*')[^;]*;/gi, '');
    let output = '', end = 0;
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
      const reference = (match[1] ?? match[2] ?? match[3]).trim();
      const url = reference.startsWith('#') ? null : await resource(reference, from, 'image');
      output += css.slice(end, match.index) + (reference.startsWith('#') ? match[0] : url ? `url("${url}")` : 'none');
      end = match.index + match[0].length;
    }
    return output + css.slice(end);
  }

  const base = fileURL || path;
  try {
    // 先处理原有 style，随后再在 link 原位置插入已处理的 CSS，保持样式顺序。
    for (const style of document.querySelectorAll('style')) style.textContent = await localCSS(style.textContent, base);
    for (const element of document.querySelectorAll('[style]')) element.setAttribute('style', await localCSS(element.getAttribute('style'), base));
    for (const link of document.querySelectorAll('link')) {
      const href = link.getAttribute('href');
      const sheet = link.relList.contains('stylesheet') && href ? await resource(href, base, 'css') : null;
      if (sheet) {
        const style = link.ownerDocument.createElement('style');
        style.textContent = await localCSS(sheet.text, sheet.path);
        if (link.media) style.media = link.media;
        link.replaceWith(style);
      } else link.remove();
    }
    for (const image of document.querySelectorAll('img')) {
      const source = image.getAttribute('src');
      const url = source ? await resource(source, base, 'image') : null;
      image.removeAttribute('src');
      image.removeAttribute('loading');
      if (url) image.src = url;
    }
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        // 预览只保留静态内容；真实链接不进入 iframe，避免点击产生导航。
        if (/^on/.test(name) || ['href', 'xlink:href', 'background', 'manifest', 'data', 'codebase', 'archive'].includes(name) || (name === 'src' && element.localName !== 'img')) element.removeAttribute(attribute.name);
      }
      if (element.matches('input, button, select, textarea')) element.setAttribute('disabled', '');
    }
    const headings = [], used = new Set();
    for (const heading of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const text = heading.textContent.trim();
      if (!text) continue;
      const baseSlug = headingSlug(text);
      let slug = baseSlug, index = 0;
      while (used.has(slug)) slug = `${baseSlug}-${++index}`;
      used.add(slug);
      // 保留原有 ID，避免破坏 HTML 自身的 CSS ID 选择器。
      if (!heading.id) heading.id = `doc-${slug}`;
      headings.push({ id: heading.id, slug, text, level: Number(heading.localName[1]) });
    }
    const head = document.querySelector('head');
    const policy = document.ownerDocument.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy'; policy.content = HTML_PREVIEW_CSP;
    head.prepend(policy);
    const defaults = document.ownerDocument.createElement('style');
    defaults.textContent = 'html{scroll-behavior:auto}body{margin:24px;font-family:system-ui,sans-serif;line-height:1.6}img{max-width:100%;height:auto}h1,h2,h3,h4,h5,h6{scroll-margin-top:24px}';
    policy.after(defaults);
    // 外部 CSS 转为内嵌样式时，不能让样式字符串提前闭合 HTML 的 style 标签。
    for (const style of document.querySelectorAll('style')) style.textContent = style.textContent.replace(/<\/style/gi, (match) => match.replace('/', '\\/'));
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { srcdoc: '<!doctype html>' + document.outerHTML, headings, skipped, dispose };
  } catch (error) { dispose(); throw error; }
}

/** 单独的 CSS 文件没有页面结构，只提取合法色值作为辅助预览。 */
export function cssColors(source) {
  const candidates = source.match(/#[\da-f]{3,8}\b|(?:rgba?|hsla?)\([^;{}\n]+\)/gi) || [];
  return [...new Set(candidates.filter((color) => CSS.supports('color', color)))].slice(0, 24);
}
