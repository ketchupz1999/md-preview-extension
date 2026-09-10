import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import { resolveLocalPath, findFile, isImage, MAX_IMAGE_BYTES } from './files.js';
import { localFileReference } from './file-url-policy.js';
import { LocalURLFile } from './file-url.js';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
    }
    return `<pre><code>${markdown.utils.escapeHtml(code)}</code></pre>`;
  },
});
const escape = (text) => markdown.utils.escapeHtml(text);

/** 标题和手写标题链接共用相同的锚点规范。 */
export function headingSlug(text) {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || 'section';
}
const defaultFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  if (tokens[index].info.trim().toLowerCase() !== 'mermaid') return defaultFence(tokens, index, options, env, renderer);
  const diagramIndex = env.diagrams.length;
  env.diagrams.push(tokens[index].content);
  return `<figure class="mermaid-figure"><div class="diagram-toolbar"><span>MERMAID</span><button type="button" data-expand-diagram="${diagramIndex}" title="放大查看图表">放大查看 ↗</button></div><div class="diagram-canvas" data-diagram-slot="${diagramIndex}"><span class="diagram-loading">正在本地绘制图表…</span></div><details class="diagram-source"><summary>查看图表源码</summary><pre><code>${escape(tokens[index].content)}</code></pre></details></figure>`;
};

markdown.core.ruler.push('local-headings-and-tasks', (state) => {
  const used = new Set();
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (token.type === 'heading_open') {
      const inline = state.tokens[i + 1];
      const text = (inline.children || []).map((child) => child.content).join('');
      const base = headingSlug(text);
      let slug = base, n = 0;
      while (used.has(slug)) slug = `${base}-${++n}`;
      used.add(slug);
      // 加固定前缀，避免文档标题覆盖阅读器自身的 DOM ID。
      token.attrSet('id', `doc-${slug}`);
      state.env.headings.push({ id: `doc-${slug}`, slug, text, level: Number(token.tag.slice(1)) });
    }
    if (token.type === 'inline' && state.tokens[i - 1]?.type === 'paragraph_open' && state.tokens[i - 2]?.type === 'list_item_open') {
      const first = token.children?.[0];
      if (first?.type === 'text') first.content = first.content.replace(/^\[([ xX])\] /, (_, checked) => checked === ' ' ? '☐ ' : '☑ ');
    }
  }
});

markdown.renderer.rules.link_open = (tokens, index, options, env) => {
  const target = tokens[index].attrGet('href') || '';
  const fileReference = env.fileURL && localFileReference(env.fileURL, target);
  if (fileReference) {
    const heading = fileReference.heading ? headingSlug(fileReference.heading) : '';
    return `<a href="#${escape(`doc-${heading}`)}" data-file-url="${escape(fileReference.url)}" data-heading="${escape(heading)}" data-original-heading="${escape(fileReference.heading)}">`;
  }
  const local = resolveLocalPath(env.path, target);
  if (local) {
    const heading = local.heading ? headingSlug(local.heading) : '';
    return `<a href="#${escape(`doc-${heading}`)}" data-local-path="${escape(local.path)}" data-heading="${escape(heading)}" data-original-heading="${escape(local.heading)}">`;
  }
  // 外链不含真实 href，即使中键点击或拖拽也不会发起导航。
  return `<a role="link" tabindex="0" class="external-link" data-external-url="${escape(target)}" title="外部链接已停用 · 点击复制地址">`;
};

markdown.renderer.rules.image = (tokens, index, options, env) => {
  const token = tokens[index];
  const source = token.attrGet('src') || '';
  const alt = token.content || '图片';
  const fileReference = env.fileURL && localFileReference(env.fileURL, source);
  if (fileReference && isImage(decodeURIComponent(new URL(fileReference.url).pathname))) {
    const id = env.images.length;
    env.images.push({ url: fileReference.url, alt });
    return `<span class="image-placeholder" data-image-slot="${id}">${escape(alt)}<small>正在读取本地图片…</small></span>`;
  }
  const local = resolveLocalPath(env.path, source);
  if (!local || !isImage(local.path)) {
    env.blockedImages++;
    return `<span class="image-placeholder">图片未加载 · ${escape(alt)}<small>仅显示可读取的本地位图</small></span>`;
  }
  const id = env.images.length;
  env.images.push({ path: local.path, alt });
  return `<span class="image-placeholder" data-image-slot="${id}">${escape(alt)}<small>正在读取本地图片…</small></span>`;
};

/** 解析为无远程资源、无可执行 HTML 的 Markdown。 */
export function parseMarkdown(source, path, fileURL = '') {
  const env = { path, fileURL, headings: [], images: [], diagrams: [], blockedImages: 0 };
  const html = markdown.render(source, env);
  return { html, ...env };
}

/** 从授权目录填充本地图片；每次阅读结束统一释放 Blob URL。 */
export async function hydrateImages(container, images, root, signal) {
  const urls = [];
  const release = () => urls.forEach((url) => URL.revokeObjectURL(url));
  signal.addEventListener('abort', release, { once: true });
  for (let index = 0; index < images.length; index++) {
    if (signal.aborted) break;
    const slot = container.querySelector(`[data-image-slot="${index}"]`);
    if (!slot) continue;
    try {
      const handle = images[index].url ? new LocalURLFile(images[index].url) : await findFile(root, images[index].path);
      const file = await handle.getFile();
      if (file.size > MAX_IMAGE_BYTES) throw new Error('图片超过 20 MB');
      if (signal.aborted) break;
      // 文件按图片上下文加载，禁止 SVG / HTML 等活跃内容。
      const url = URL.createObjectURL(file);
      urls.push(url);
      const image = document.createElement('img');
      image.alt = images[index].alt;
      // 提前获得图片尺寸，完成布局后才能可靠恢复滚动位置或跳转标题。
      image.loading = 'eager';
      image.src = url;
      slot.replaceWith(image);
      try { await image.decode(); }
      catch { if (!signal.aborted) image.replaceWith(document.createTextNode(`无法显示图片：${image.alt}`)); }
    } catch (error) {
      if (!signal.aborted) slot.textContent = `图片未加载 · ${images[index].alt}（${error.message}）`;
    }
  }
}

/** 源码仅做转义和静态代码高亮。 */
export function highlightSource(source, path) {
  const language = path.split('.').at(-1);
  if (hljs.getLanguage(language)) return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  return escape(source);
}
