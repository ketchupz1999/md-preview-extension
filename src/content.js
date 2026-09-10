import { isLocalMarkdownURL } from './file-url-policy.js';

// 仅接管顶层本地 Markdown，普通网页和其他文件保持原样。
if (window === window.top && isLocalMarkdownURL(location.href)) {
  window.stop();
  chrome.runtime.sendMessage({ type: 'open-local-markdown' }).then((response) => {
    // 替换原 file 页面，避免浏览器后退到原页面后再次被接管。
    if (response?.readerURL?.startsWith(`${chrome.runtime.getURL('reader.html')}?file=`)) location.replace(response.readerURL);
  }).catch(() => {});
}
