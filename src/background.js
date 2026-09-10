import { isLocalMarkdownURL } from './file-url-policy.js';

function readerURL(fileURL) {
  const url = new URL(chrome.runtime.getURL('reader.html'));
  if (fileURL) url.searchParams.set('file', fileURL);
  return url.href;
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null && isLocalMarkdownURL(tab.url)) chrome.tabs.reload(tab.id);
  else chrome.tabs.create({ url: readerURL() });
});

// 来源由浏览器提供，不接受消息正文传入的任意 URL 或标签页 ID。
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'open-local-markdown' || sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id == null || !isLocalMarkdownURL(sender.url)) return;
  respond({ readerURL: readerURL(sender.url) });
});
