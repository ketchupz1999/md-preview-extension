/** 仅接受本机 file URL，拒绝远程共享、其他协议和路径分隔符编码。 */
export function localFileURL(value) {
  try {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname);
    if (url.protocol !== 'file:' || url.hostname || pathname.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(pathname) || /%2f|%5c/i.test(url.pathname)) return null;
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return null; }
}

export function isLocalMarkdownURL(value) {
  const url = localFileURL(value);
  return !!url && /\.(md|markdown|mdown|mkd|mdx)$/i.test(decodeURIComponent(new URL(url).pathname));
}

/** 按文件 URL 解析文档引用，保留标题片段，始终禁止切换到联网协议。 */
export function localFileReference(currentURL, reference) {
  if (!localFileURL(currentURL) || typeof reference !== 'string' || /[\u0000-\u001f\u007f\\]/.test(reference)) return null;
  try {
    const target = new URL(reference, currentURL);
    const url = localFileURL(target.href);
    if (!url) return null;
    return { url, heading: decodeURIComponent(target.hash.slice(1)) };
  } catch { return null; }
}
