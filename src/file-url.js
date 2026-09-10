import { localFileURL } from './file-url-policy.js';

/** 有界读取本机文件，HTTP/HTTPS 不会进入读取函数。 */
async function readLocalFile(url, maxBytes) {
  const safeURL = localFileURL(url);
  if (!safeURL) throw new Error('只支持本机文件路径。');
  // Chromium 的目录索引包含内部重定向；联网重定向仍由 connect-src file: 阻止。
  const response = await fetch(safeURL, { cache: 'no-store', redirect: safeURL.endsWith('/') ? 'follow' : 'error' });
  if (response.url && !localFileURL(response.url)) throw new Error('拒绝非本机文件响应。');
  // Chromium 内建目录索引有可读正文，但状态码为 0。
  if (response.status !== 0 && !response.ok) throw new Error('文件无法读取，可能已移动或删除。');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('文件没有可读内容。');
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error(`文件超过 ${maxBytes / 1024 / 1024} MB。`); }
    chunks.push(value);
  }
  return { blob: new Blob(chunks, { type: response.headers.get('content-type') || '' }), modified: Date.parse(response.headers.get('last-modified')) || 0 };
}

function childURL(parentURL, name) {
  if (!name || name === '.' || name === '..' || /[\/\\\u0000-\u001f\u007f]/.test(name)) throw new Error('文件名无效。');
  return new URL(encodeURIComponent(name), parentURL).href;
}

/** 从 Chromium 的目录索引提取数据，不运行其中的任何脚本。 */
export function parseDirectoryListing(html, parentURL) {
  const root = localFileURL(parentURL);
  if (!root || !root.endsWith('/')) throw new Error('目录路径无效。');
  if (!html.includes('onHasParentDirectory') && !html.includes('function addRow')) throw new Error('浏览器未返回可识别的目录索引。');
  const entries = [];
  for (const match of html.matchAll(/<script>\s*addRow\(([^\n]*)\);?\s*<\/script>/g)) {
    try {
      const [name, href, directory] = JSON.parse(`[${match[1]}]`);
      if (typeof name !== 'string' || typeof href !== 'string' || (directory !== 0 && directory !== 1)) continue;
      const expected = childURL(root, name);
      const candidate = localFileURL(new URL(href, root).href);
      if (!candidate || decodeURIComponent(new URL(candidate).pathname) !== decodeURIComponent(new URL(expected).pathname)) continue;
      entries.push({ name, kind: directory ? 'directory' : 'file', url: directory ? `${expected}/` : expected });
    } catch { /* 忽略不符合 Chromium 数据格式的行。 */ }
  }
  return entries;
}

/** 为 file URL 提供和目录选择器相同的只读文件接口。 */
export class LocalURLFile {
  constructor(url) {
    this.url = localFileURL(url);
    if (!this.url || this.url.endsWith('/')) throw new Error('文件路径无效。');
    this.name = decodeURIComponent(new URL(this.url).pathname.split('/').at(-1));
    this.kind = 'file';
  }
  async getFile() {
    const { blob, modified } = await readLocalFile(this.url, /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(this.name) ? 20 * 1024 * 1024 : 8 * 1024 * 1024);
    const file = new File([blob], this.name, { type: blob.type, lastModified: modified });
    // 本地 URL 通常没有 Last-Modified，用内容摘要检测编辑器保存。
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    file.contentVersion = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return file;
  }
}

/** 使用 Chromium 的本地目录索引浏览文件，无本地服务或目录选择器。 */
export class LocalURLDirectory {
  constructor(url) {
    this.url = localFileURL(url);
    if (!this.url || !this.url.endsWith('/')) throw new Error('目录路径无效。');
    this.name = decodeURIComponent(new URL(this.url).pathname.split('/').at(-2)) || '/';
    this.kind = 'directory';
  }
  async *entries() {
    const { blob } = await readLocalFile(this.url, 8 * 1024 * 1024);
    for (const entry of parseDirectoryListing(await blob.text(), this.url)) {
      yield [entry.name, entry.kind === 'directory' ? new LocalURLDirectory(entry.url) : new LocalURLFile(entry.url)];
    }
  }
  async getDirectoryHandle(name) { return new LocalURLDirectory(`${childURL(this.url, name)}/`); }
  async getFileHandle(name) { return new LocalURLFile(childURL(this.url, name)); }
  async resolve(handle) {
    if (!handle.url?.startsWith(this.url)) return null;
    return handle.url.slice(this.url.length).split('/').filter(Boolean).map(decodeURIComponent);
  }
}
