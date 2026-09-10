import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, IconButton } from './icons.jsx';
import { FileTree, Outline } from './sidebar.jsx';
import { DiagramDialog } from './diagram-dialog.jsx';
import { DEMO } from './demo.js';
import { findFile, isImage, isMarkdown, isText, listDirectory, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, savedSession, searchDirectory } from './files.js';
import { headingSlug, highlightSource, hydrateImages, observeTableOverflow, parseMarkdown } from './markdown.js';
import { LocalURLDirectory, LocalURLFile } from './file-url.js';
import { localFileReference, localFileURL } from './file-url-policy.js';
import { isHTML, prepareHTML, cssColors } from './html-preview.js';

const demoSelection = { path: '使用说明.md', demo: true };
const initialNavigation = { entries: [demoSelection], index: 0 };

function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem('preferences')) || {};
    return { dark: typeof value.dark === 'boolean' ? value.dark : matchMedia('(prefers-color-scheme: dark)').matches, font: [16, 18, 20, 22, 24].includes(value.font) ? value.font : 18, showHidden: value.showHidden === true, autoRefresh: value.autoRefresh !== false };
  } catch { return { dark: false, font: 18, showHidden: false, autoRefresh: true }; }
}

/** 阅读器入口：目录授权、导航与只读文档呈现。 */
function App() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [library, setLibrary] = useState(null);
  const [navigation, setNavigation] = useState(initialNavigation);
  const selection = navigation.entries[navigation.index];
  const [documentState, setDocumentState] = useState(null);
  const [revision, setRevision] = useState(0);
  const [fileAccess, setFileAccess] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('outline');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restore, setRestore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [activeHeading, setActiveHeading] = useState('');
  const [targetHeading, setTargetHeading] = useState('');
  const [diagramPreview, setDiagramPreview] = useState(null);
  const searchInput = useRef();
  const fileInput = useRef();
  const readingPane = useRef();
  const article = useRef();
  const htmlFrame = useRef();
  const htmlScrollCleanup = useRef(() => {});
  const htmlViewPosition = useRef(null);
  const libraryEpoch = useRef(0);
  const lastPath = useRef('');
  const position = useRef({ path: '', top: 0 });
  const restoreTop = useRef(null);
  const selectedRef = useRef(selection);
  const loadedSelection = useRef(null);
  const imagesReadyRef = useRef(Promise.resolve());
  selectedRef.current = selection;
  const headings = documentState?.parsed?.headings || documentState?.html?.headings || [];

  const notify = (message) => setToast(message);
  const updatePreference = (key, value) => setPreferences((previous) => ({ ...previous, [key]: value }));
  const resetNavigation = (next) => setNavigation({ entries: [next || demoSelection], index: 0 });

  const navigate = (entry, heading = '') => {
    setTargetHeading(heading);
    setQuery('');
    setSourceMode(false);
    if (!selection.demo && selection.path === entry.path && selection.handle === entry.handle) return;
    setNavigation((previous) => ({ entries: [...previous.entries.slice(0, previous.index + 1), entry], index: previous.index + 1 }));
  };

  function openExtensionSettings() {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  }

  async function hasFileAccess() {
    const allowed = await new Promise((resolve) => chrome.extension.isAllowedFileSchemeAccess(resolve));
    setFileAccess(allowed);
    return allowed;
  }

  async function loadLocalURL(value, top = 0, heading = '') {
    const url = localFileURL(value);
    if (!url) return notify('只能打开本机文件。');
    const epoch = ++libraryEpoch.current;
    const allowed = await hasFileAccess();
    if (epoch !== libraryEpoch.current) return;
    if (!allowed) { setRestore({ fileURL: url, top }); return; }
    const file = new LocalURLFile(url);
    const root = new LocalURLDirectory(new URL('.', url).href);
    setTargetHeading(heading);
    await loadDirectory(root, file.name, top);
  }

  // 目录选择与启动恢复可能先后完成；只接受最新一次操作的结果。
  async function loadDirectory(handle, previousPath = '', top = 0) {
    const epoch = ++libraryEpoch.current;
    setBusy(true);
    try {
      let entries, directoryError = '';
      try { entries = await listDirectory(handle, '', preferences.showHidden); }
      catch (error) {
        if (!handle.url || !previousPath) throw error;
        // 目录索引不可用时仍打开用户指定的文件，明确提示目录读取失败。
        entries = [{ name: previousPath, path: previousPath, kind: 'file', handle: await findFile(handle, previousPath) }];
        directoryError = '目录暂时无法读取，可重新打开文件夹。';
      }
      let initial = null;
      if (previousPath) {
        try { initial = { path: previousPath, handle: await findFile(handle, previousPath) }; }
        catch { notify('上次的文件已移动或不可读，请在目录中重新选择。'); }
      }
      initial ||= entries.find((entry) => entry.kind === 'file' && /^readme\.(md|markdown)$/i.test(entry.name)) || entries.find((entry) => entry.kind === 'file' && isMarkdown(entry.name));
      if (epoch !== libraryEpoch.current) return;
      setLibrary({ root: handle, entries, directoryError });
      lastPath.current = '';
      position.current = { path: '', top: 0 };
      resetNavigation(initial);
      setSourceMode(false);
      restoreTop.current = { path: initial?.path, top: initial?.path === previousPath ? top : 0 };
      setRestore(null); setQuery(''); setSettingsOpen(false);
    } catch (error) { if (epoch === libraryEpoch.current) notify(`无法打开目录：${error.message}`); }
    finally { if (epoch === libraryEpoch.current) setBusy(false); }
  }

  async function chooseDirectory() {
    try {
      if (!window.showDirectoryPicker) return notify('目录浏览需要桌面版 Chrome 或 Edge。');
      const root = await window.showDirectoryPicker({ id: 'local-markdown-folder', mode: 'read' });
      await loadDirectory(root);
    } catch (error) { if (error.name !== 'AbortError') notify(`无法选择目录：${error.message}`); }
  }

  async function openHandle(handle, volatile = false) {
    const epoch = ++libraryEpoch.current;
    let path = null;
    if (library && !volatile) {
      try { path = await library.root.resolve(handle); } catch { /* 单文件仍可阅读。 */ }
    }
    if (epoch !== libraryEpoch.current) return;
    setBusy(false); setRestore(null);
    if (path) navigate({ path: path.join('/'), handle });
    else { setLibrary(null); lastPath.current = ''; position.current = { path: '', top: 0 }; resetNavigation({ path: handle.name, handle, volatile }); setQuery(''); }
  }

  async function chooseFile() {
    try {
      if (!window.showOpenFilePicker) return fileInput.current.click();
      const [handle] = await window.showOpenFilePicker({ id: 'local-markdown-file', multiple: false });
      await openHandle(handle);
    } catch (error) { if (error.name !== 'AbortError') notify(`无法选择文件：${error.message}`); }
  }

  async function resumeSession() {
    try {
      if (restore.fileURL) return await loadLocalURL(restore.fileURL, restore.top);
      const handle = restore.root || restore.file;
      if (await handle.requestPermission({ mode: 'read' }) !== 'granted') return notify('尚未获得读取权限，你也可以重新选择目录。');
      if (restore.root) await loadDirectory(restore.root, restore.path, restore.top);
      else { restoreTop.current = { path: restore.path, top: restore.top || 0 }; await openHandle(restore.file); }
      setRestore(null);
    } catch { notify('上次的位置已不可用，请重新打开文件夹。'); }
  }

  function forgetDirectory() {
    ++libraryEpoch.current;
    setBusy(false); setLibrary(null); setRestore(null); setQuery(''); setSettingsOpen(false);
    resetNavigation(demoSelection);
    history.replaceState(null, '', location.pathname);
    void savedSession(null).catch(() => notify('无法清除本地记录，请在浏览器扩展设置中清除数据。'));
  }

  useEffect(() => {
    const epoch = libraryEpoch.current;
    savedSession().catch(() => null).then(async (session) => {
      if (epoch !== libraryEpoch.current) return;
      const requestedFile = new URL(location.href).searchParams.get('file');
      if (requestedFile) {
        const reference = localFileReference(requestedFile, requestedFile);
        return loadLocalURL(requestedFile, session?.fileURL === localFileURL(requestedFile) ? session.top : 0, reference?.heading || '');
      }
      if (!session) return;
      if (session.fileURL) return loadLocalURL(session.fileURL, session.top);
      const handle = session.root || session.file;
      const permission = await handle.queryPermission({ mode: 'read' });
      if (epoch !== libraryEpoch.current) return;
      if (permission !== 'granted') return setRestore(session);
      if (session.root) await loadDirectory(session.root, session.path, session.top);
      else {
        restoreTop.current = { path: session.path, top: session.top || 0 };
        await openHandle(session.file);
      }
    }).catch(() => notify('无法恢复上次的位置，请重新打开文件夹。'));
  }, []);

  useEffect(() => {
    void hasFileAccess();
    window.addEventListener('focus', hasFileAccess);
    return () => window.removeEventListener('focus', hasFileAccess);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.dark ? 'dark' : 'light';
    try { localStorage.setItem('preferences', JSON.stringify(preferences)); } catch { /* 存储不可用时仍允许阅读。 */ }
  }, [preferences]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!library && selection.demo) return;
    const address = new URL(location.href);
    if (selection.handle?.url) address.searchParams.set('file', selection.handle.url);
    else address.searchParams.delete('file');
    history.replaceState(null, '', address.href);
    const persist = () => {
      const top = restoreTop.current?.path === selection.path ? restoreTop.current.top : position.current.path === selection.path ? position.current.top : 0;
      const record = selection.volatile ? null : selection.handle?.url ? { fileURL: selection.handle.url, top } : { root: library?.root || null, file: library ? null : selection.handle, path: selection.demo ? '' : selection.path, top };
      void savedSession(record).catch(() => notify('本次可以阅读，但浏览器未能记住这个位置。'));
    };
    persist();
    // 滚动后防抖保存，只写位置与句柄，不写文档内容。
    let timer;
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(persist, 500); };
    readingPane.current?.addEventListener('scroll', onScroll);
    const pane = readingPane.current;
    return () => { clearTimeout(timer); pane?.removeEventListener('scroll', onScroll); };
  }, [library, selection]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (loadedSelection.current === selection) {
      // 自动刷新时保留旧正文，待图表重新布局完毕后再恢复原来的位置。
      restoreTop.current ||= { path: selection.path, top: documentState?.html && !sourceMode ? htmlFrame.current?.contentWindow?.scrollY || 0 : readingPane.current.scrollTop };
    } else {
      if (restoreTop.current?.path !== selection.path) restoreTop.current = null;
      setDocumentState(null);
    }
    const read = async () => {
      const file = selection.demo ? null : await selection.handle.getFile();
      if (cancelled) return;
      if (file && !isText(selection.path) && !isImage(selection.path)) throw new Error('暂不支持此文件类型。可阅读 Markdown、常见文本、代码与位图图片。');
      if (file?.size > (isImage(selection.path) ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES)) throw new Error(`文件过大，${isImage(selection.path) ? '图片上限为 20 MB' : '文本上限为 8 MB'}。`);
      if (file && isImage(selection.path)) { loadedSelection.current = selection; return setDocumentState({ file, image: true }); }
      const source = selection.demo ? DEMO : await file.text();
      if (source.includes('\0')) throw new Error('此文件包含二进制内容，无法作为文本阅读。');
      const parsed = isMarkdown(selection.path) ? parseMarkdown(source, selection.path, selection.handle?.url) : null;
      const html = isHTML(selection.path) ? await prepareHTML(source, { path: selection.path, fileURL: selection.handle?.url, root: library?.root }, controller.signal) : null;
      if (!cancelled) { loadedSelection.current = selection; setDocumentState({ file, source, parsed, html }); }
      else html?.dispose();
    };
    read().catch((error) => { if (!cancelled) setDocumentState({ error: error.name === 'NotFoundError' ? '文件已移动或删除，请在文件夹中重新选择。' : error.name === 'NotAllowedError' ? '读取权限已失效，请重新打开文件夹。' : error.message }); });
    return () => { cancelled = true; controller.abort(); };
  }, [selection, revision]);

  useEffect(() => {
    if (!article.current || !documentState || documentState.error) return;
    if (documentState.html && !sourceMode) return;
    const controller = new AbortController();
    if (!sourceMode && documentState.parsed) observeTableOverflow(article.current, controller.signal);
    let imagesReady = !sourceMode && documentState.parsed ? hydrateImages(article.current, documentState.parsed.images, library?.root, controller.signal) : Promise.resolve();
    let imageURL;
    if (documentState.image) {
      imageURL = URL.createObjectURL(documentState.file);
      const image = article.current.querySelector('img');
      image.src = imageURL;
      imagesReady = image.decode().catch(() => { if (!controller.signal.aborted) notify('无法解码这张图片。'); });
    }
    imagesReadyRef.current = imagesReady;
    document.title = `${selection.path.split('/').at(-1)} · MD Preview`;
    if (!documentState.parsed?.diagrams.length || sourceMode) {
      imagesReady.then(() => { if (!controller.signal.aborted) settleReadingPosition(); });
    }
    return () => { controller.abort(); if (imageURL) URL.revokeObjectURL(imageURL); };
  }, [documentState, sourceMode]);

  useEffect(() => {
    if (!article.current || !documentState?.parsed?.diagrams.length || sourceMode) return;
    const controller = new AbortController();
    const container = article.current;
    const diagramsReady = import('./diagrams.js').then(({ renderDiagrams }) => renderDiagrams(container, documentState.parsed.diagrams, preferences.dark, controller.signal));
    Promise.all([imagesReadyRef.current, diagramsReady]).then(() => {
      if (!controller.signal.aborted) settleReadingPosition();
    }).catch(() => {
      if (!controller.signal.aborted) notify('本地图表组件加载失败，请重新加载扩展。');
    });
    return () => controller.abort();
  }, [documentState, sourceMode, preferences.dark]);

  useEffect(() => {
    if (!preferences.autoRefresh || !selection.handle || selection.volatile || !documentState?.file) return;
    let cancelled = false, checking = false;
    const timer = setInterval(async () => {
      if (document.hidden || checking || !documentState) return;
      checking = true;
      try {
        const file = await selection.handle.getFile();
        if (!cancelled && (file.lastModified !== documentState.file?.lastModified || file.size !== documentState.file?.size || file.contentVersion !== documentState.file?.contentVersion)) setRevision((value) => value + 1);
      } catch { if (!cancelled && !documentState.error) setDocumentState({ error: '文件已不可读，可能已移动、删除或权限失效。请重新选择文件。' }); }
      finally { checking = false; }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selection, documentState, preferences.autoRefresh]);

  useEffect(() => {
    if (!library) return;
    let cancelled = false;
    const root = library.root;
    listDirectory(root, '', preferences.showHidden).then((entries) => {
      if (!cancelled) setLibrary((previous) => previous?.root === root ? ({ ...previous, entries, directoryError: '' }) : previous);
    }).catch(() => { if (!cancelled) notify('无法刷新目录，请重新选择文件夹。'); });
    return () => { cancelled = true; };
  }, [library?.root, preferences.showHidden, revision]);

  useEffect(() => {
    if (!query.trim() || !library) { setSearch(null); return; }
    const controller = new AbortController();
    setSearch({ loading: true });
    const timer = setTimeout(() => {
      searchDirectory(library.root, query.trim(), preferences.showHidden, controller.signal).then((result) => {
        if (!controller.signal.aborted && result) setSearch(result);
      }).catch(() => { if (!controller.signal.aborted) setSearch({ error: true }); });
    }, 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, library?.root, preferences.showHidden, revision]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSidebarVisible(true); setSidebarTab('files');
        setTimeout(() => searchInput.current?.focus(), 0);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); setSidebarVisible((value) => !value); }
      if (event.key === 'Escape') { setSettingsOpen(false); setQuery(''); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function jumpToHeading(slug) {
    if (!slug) { if (documentState?.html && !sourceMode) htmlFrame.current?.contentWindow?.scrollTo(0, 0); else readingPane.current.scrollTop = 0; return; }
    const previewDocument = !sourceMode && documentState?.html ? htmlFrame.current?.contentDocument : null;
    const normalized = headingSlug(slug);
    const id = previewDocument ? headings.find((heading) => heading.slug === normalized)?.id : `doc-${normalized}`;
    // HTML 先遵循原始 fragment / ID，Markdown 和标题文字链接再按 slug 匹配。
    const element = previewDocument ? previewDocument.getElementById(slug) || previewDocument.getElementById(id) : document.getElementById(`doc-${slug}`) || document.getElementById(id);
    if (element && (previewDocument || article.current?.contains(element))) { element.scrollIntoView({ block: 'start' }); setActiveHeading(element.id); }
    setTargetHeading('');
  }

  function toggleSourceMode() {
    if (documentState?.html) {
      if (!sourceMode) htmlViewPosition.current = { selection, top: htmlFrame.current?.contentWindow?.scrollY || 0 };
      else restoreTop.current = { path: selection.path, top: htmlViewPosition.current?.selection === selection ? htmlViewPosition.current.top : 0 };
    }
    setSourceMode(!sourceMode);
  }

  function settleReadingPosition() {
    if (selectedRef.current !== selection) return;
    const pending = restoreTop.current;
    if (pending?.path === selection.path) { readingPane.current.scrollTop = pending.top || 0; restoreTop.current = null; }
    else if (lastPath.current !== selection.path) readingPane.current.scrollTop = 0;
    lastPath.current = selection.path;
    if (targetHeading) jumpToHeading(targetHeading);
    else onReadingScroll();
  }

  async function onDocumentClick(event) {
    const expand = event.target.closest('button[data-expand-diagram]');
    if (expand) {
      const svg = article.current.querySelector(`[data-diagram-slot="${expand.dataset.expandDiagram}"] svg`);
      if (svg) setDiagramPreview(svg.outerHTML);
      else notify('图表还未绘制完成，可先展开图表源码。');
      return;
    }
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    if (link.dataset.externalUrl) {
      try { await navigator.clipboard.writeText(link.dataset.externalUrl); notify('已复制链接地址。阅读器没有打开网站。'); }
      catch { notify(`外部链接已停用：${link.dataset.externalUrl}`); }
      return;
    }
    if (link.dataset.fileUrl) {
      const heading = link.dataset.originalHeading ?? link.dataset.heading;
      if (link.dataset.fileUrl === selection.handle?.url) return jumpToHeading(heading);
      const epoch = libraryEpoch.current;
      const currentSelection = selection;
      try {
        const handle = new LocalURLFile(link.dataset.fileUrl);
        const path = await library?.root.resolve(handle);
        if (epoch !== libraryEpoch.current || selectedRef.current !== currentSelection) return;
        if (path) navigate({ path: path.join('/'), handle }, heading);
        else await loadLocalURL(handle.url, 0, heading);
      } catch { notify('无法打开链接的本地文件。'); }
      return;
    }
    const path = link.dataset.localPath;
    if (!path) return;
    const heading = link.dataset.originalHeading ?? link.dataset.heading;
    if (path === selection.path) return jumpToHeading(heading);
    const epoch = libraryEpoch.current;
    const currentSelection = selection;
    try {
      const handle = await findFile(library?.root, path);
      if (epoch === libraryEpoch.current && currentSelection === selectedRef.current) navigate({ path, handle }, heading);
    } catch { notify('找不到链接文件，请确认目标位于已打开的文件夹中。'); }
  }

  useEffect(() => () => { documentState?.html?.dispose(); }, [documentState]);
  useEffect(() => () => { htmlScrollCleanup.current(); }, [documentState, sourceMode]);

  function onHTMLLoad() {
    const frame = htmlFrame.current;
    const previewDocument = frame?.contentDocument;
    if (!previewDocument?.body || !documentState?.html) return;
    htmlScrollCleanup.current();
    document.title = `${selection.path.split('/').at(-1)} · MD Preview`;
    const onScroll = () => {
      position.current = { path: selection.path, top: frame.contentWindow.scrollY };
      let active = headings[0]?.id || '';
      for (const heading of headings) {
        const element = previewDocument.getElementById(heading.id);
        if (element?.getBoundingClientRect().top <= 80) active = heading.id;
      }
      setActiveHeading(active);
      // 复用父页的位置保存防抖，不给静态 HTML 注入脚本。
      readingPane.current?.dispatchEvent(new Event('scroll'));
    };
    frame.contentWindow.addEventListener('scroll', onScroll);
    htmlScrollCleanup.current = () => frame.contentWindow?.removeEventListener('scroll', onScroll);
    const pending = restoreTop.current;
    if (pending?.path === selection.path) { frame.contentWindow.scrollTo(0, pending.top || 0); restoreTop.current = null; }
    if (targetHeading) jumpToHeading(targetHeading);
    lastPath.current = selection.path;
    onScroll();
  }

  function onReadingScroll() {
    if (documentState?.html && !sourceMode) return;
    const pane = readingPane.current;
    position.current = { path: selection.path, top: pane.scrollTop };
    const top = pane.getBoundingClientRect().top + 110;
    let current = headings[0]?.id || '';
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element && element.getBoundingClientRect().top <= top) current = heading.id;
    }
    setActiveHeading(current);
  }

  async function onDrop(event) {
    event.preventDefault();
    const item = event.dataTransfer.items[0];
    if (!item) return;
    try {
      // 在第一次 await 之前获取句柄，避免拖放授权过期。
      const file = event.dataTransfer.files[0];
      const handle = item.getAsFileSystemHandle ? await item.getAsFileSystemHandle() : null;
      if (handle?.kind === 'directory') await loadDirectory(handle);
      else if (handle?.kind === 'file') await openHandle(handle);
      else if (file) await openHandle({ name: file.name, getFile: async () => file }, true);
    } catch { notify('无法读取拖入的文件，请使用打开文件夹或打开文件。'); }
  }

  const fileName = selection.path.split('/').at(-1);
  const date = documentState?.file?.lastModified ? new Date(documentState.file.lastModified).toLocaleString('zh-CN', { hour12: false }) : '';

  return <div class={`app ${sidebarVisible ? '' : 'sidebar-hidden'} text-size-${preferences.font}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <aside class="sidebar" aria-label="文档导航" inert={!sidebarVisible}>
      <header class="sidebar-header">
        <img class="brand-mark" src="icons/32.png" width="24" height="24" alt=""/><strong>MD Preview</strong>
        <div class="sidebar-tools"><IconButton icon="folder" label="打开文件夹" disabled={busy} onClick={chooseDirectory}/><IconButton icon="file" label="打开单个文件" onClick={chooseFile}/><IconButton icon="settings" label="阅读设置" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}/></div>
      </header>
      {settingsOpen && <div class="settings-panel"><strong>阅读设置</strong><label class="font-setting">文字大小<select aria-label="文字大小" value={preferences.font} onChange={(event) => updatePreference('font', Number(event.currentTarget.value))}>{[16,18,20,22,24].map((size) => <option value={size}>{size}px</option>)}</select></label><label><input type="checkbox" checked={preferences.autoRefresh} onChange={(event) => updatePreference('autoRefresh', event.currentTarget.checked)}/>自动检测文件变化</label><label><input type="checkbox" checked={preferences.showHidden} onChange={(event) => updatePreference('showHidden', event.currentTarget.checked)}/>显示隐藏文件</label><button onClick={openExtensionSettings}>本地文件访问权限</button><button onClick={forgetDirectory}>关闭并忘记位置</button></div>}
      {restore && <div class="restore"><span>{restore.fileURL ? '开启本地文件访问后继续阅读' : `继续阅读 ${restore.root?.name || restore.file?.name}`}</span><button aria-label={restore.fileURL && !fileAccess ? '打开扩展设置' : '重新打开'} onClick={restore.fileURL && !fileAccess ? openExtensionSettings : resumeSession}>{restore.fileURL && !fileAccess ? '开启权限' : '重新打开'}</button></div>}
      <div class="sidebar-tabs" role="tablist" aria-label="侧栏视图">
        <button role="tab" id="outline-tab" aria-controls="outline-panel" aria-selected={sidebarTab === 'outline'} onClick={() => setSidebarTab('outline')}><Icon name="outline"/>大纲<span>{headings.length || ''}</span></button>
        <button role="tab" id="files-tab" aria-controls="files-panel" aria-selected={sidebarTab === 'files'} onClick={() => setSidebarTab('files')}><Icon name="folder"/>文件</button>
      </div>
      <section id="outline-panel" role="tabpanel" aria-labelledby="outline-tab" class="sidebar-section outline-section" hidden={sidebarTab !== 'outline'}>
        <div class="section-scroll"><Outline headings={headings} active={activeHeading} onJump={(slug) => { if (sourceMode) { setTargetHeading(slug); setSourceMode(false); } else jumpToHeading(slug); }}/></div>
      </section>
      <section id="files-panel" role="tabpanel" aria-labelledby="files-tab" class="sidebar-section files-section" hidden={sidebarTab !== 'files'}>
        <div class="section-heading"><span title={library?.root.url || library?.root.name || '文件'}><Icon name="folder"/>{library?.root.name || '文件'}</span></div>
        <label class="search"><Icon name="search"/><input ref={searchInput} type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="搜索文件…" aria-label="搜索文件名或路径" disabled={!library}/><kbd>⌘ K</kbd></label>
        <div class="section-scroll">
          {library ? <>
            {library.directoryError && <p class="tree-message">{library.directoryError}</p>}
            {query ? <div class="search-results" aria-live="polite">
              {search?.loading && <p class="tree-message">正在查找文件…</p>}
              {search?.error && <p class="tree-message">搜索失败，请重新打开目录。</p>}
              {search?.results?.map((entry) => <button key={entry.path} class="search-result" onClick={() => navigate(entry)}><Icon name="file"/><span><strong>{entry.name}</strong><small>{entry.path}</small></span></button>)}
              {search?.results?.length === 0 && <p class="tree-message">没有找到匹配的文件</p>}
              {search?.limited && <p class="tree-message">达到搜索上限，请缩小目录或关键词。</p>}
              {!!search?.skipped && <p class="tree-message">有 {search.skipped} 个目录无法读取。</p>}
            </div> : <FileTree key={`${libraryEpoch.current}-${preferences.showHidden}-${revision}`} entries={library.entries} selectedPath={selection.demo ? '' : selection.path} onOpen={navigate} showHidden={preferences.showHidden} onError={notify}/>}
          </> : <div class="empty-library">
            {!fileAccess ? <><p>开启「允许访问文件网址」，自动预览本地 Markdown。</p><button onClick={openExtensionSettings}>打开扩展设置</button></> : <><p>打开 Markdown 后显示所在目录。</p><button onClick={chooseDirectory}>选择文件夹</button></>}
          </div>}
        </div>
      </section>
    </aside>

    <main class={`reader ${documentState?.html && !sourceMode ? 'html-reader' : ''}`}>
      <header class="toolbar">
        <div class="toolbar-leading"><IconButton icon="sidebar" label={sidebarVisible ? '收起侧边栏' : '展开侧边栏'} aria-expanded={sidebarVisible} onClick={() => setSidebarVisible(!sidebarVisible)}/><span class="toolbar-separator"/><IconButton icon="back" label="上一份文档" disabled={navigation.index === 0} onClick={() => { setTargetHeading(''); setNavigation((previous) => ({ ...previous, index: previous.index - 1 })); }}/><IconButton icon="next" label="下一份文档" disabled={navigation.index === navigation.entries.length - 1} onClick={() => { setTargetHeading(''); setNavigation((previous) => ({ ...previous, index: previous.index + 1 })); }}/></div>
        <div class="breadcrumbs" title={selection.path}>{library && !selection.demo && <><span>{library.root.name}</span><span class="crumb-slash">/</span></>}<strong>{fileName}</strong></div>
        <div class="toolbar-actions"><button class={`toolbar-button ${sourceMode ? 'active' : ''}`} aria-label={sourceMode ? '显示阅读视图' : '查看源码'} title={sourceMode ? '显示预览' : '查看文件源码'} aria-pressed={sourceMode} disabled={documentState?.source === undefined} onClick={toggleSourceMode}><Icon name="code"/>{sourceMode ? '预览' : '源码'}</button><button class="toolbar-button" aria-label="刷新文件和目录" title="重新读取当前文件和目录" onClick={() => setRevision((value) => value + 1)}><Icon name="refresh"/>刷新</button><span class="toolbar-separator"/><IconButton icon={preferences.dark ? 'sun' : 'moon'} label={preferences.dark ? '切换浅色主题' : '切换深色主题'} onClick={() => updatePreference('dark', !preferences.dark)}/></div>
      </header>
      <div class="reading-pane" ref={readingPane} onScroll={onReadingScroll}>
        <div class="document-container">
          <div class="document-eyebrow"><span>{selection.demo ? '使用说明' : isMarkdown(selection.path) ? 'MARKDOWN' : isHTML(selection.path) ? 'HTML' : /\.css$/i.test(selection.path) ? 'CSS' : isImage(selection.path) ? 'IMAGE' : 'TEXT'}</span><span class="eyebrow-line"/><span>{selection.demo ? 'MD PREVIEW' : documentState?.html && !sourceMode ? '静态预览' : '本地文件 · 只读'}</span></div>
          {!documentState ? <div class="loading-document" role="status">正在读取文档…</div> : documentState.error ? <div class="document-error" role="alert"><Icon name="file"/><h1>暂时无法阅读</h1><p>{documentState.error}</p><button onClick={chooseDirectory}>重新打开文件夹</button></div> : <article ref={article} class={`markdown-body ${sourceMode || !documentState.parsed ? 'source-document' : ''}`} onClick={onDocumentClick} onAuxClick={onDocumentClick} onKeyDown={(event) => { if (event.key === 'Enter' && event.target.matches('a[data-external-url]')) void onDocumentClick(event); }}>
            {documentState.html && !sourceMode ? <iframe ref={htmlFrame} class="html-preview" title={`HTML 预览：${fileName}`} sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={documentState.html.srcdoc} onLoad={onHTMLLoad}/> : documentState.image ? <div class="image-document"><h1>{fileName}</h1><img alt={fileName}/></div> : sourceMode || !documentState.parsed ? <>
              {!sourceMode && /\.css$/i.test(selection.path) && <div class="css-palette" aria-label="CSS 颜色预览">{cssColors(documentState.source).map((color) => <span class="css-color"><i style={{ backgroundColor: color }}/><code>{color}</code></span>)}</div>}
              <pre class="source-code"><code dangerouslySetInnerHTML={{ __html: highlightSource(documentState.source, sourceMode && isMarkdown(selection.path) ? 'source.md' : selection.path) }}/></pre>
            </> : <div dangerouslySetInnerHTML={{ __html: documentState.parsed.html }}/>}

          </article>}
          {documentState && !documentState.error && !selection.demo && <footer class="document-footer"><span>{selection.demo ? 'MD PREVIEW' : date ? `修改于 ${date}` : fileName}</span><span>{documentState.source !== undefined ? `${documentState.source.length.toLocaleString()} 字符` : `${Math.round(documentState.file.size / 1024)} KB`}<span class="footer-divider">·</span>只读</span></footer>}
        </div>
      </div>
    </main>
    <input class="file-input" type="file" ref={fileInput} aria-label="导入本地文件" onChange={(event) => { const file = event.currentTarget.files[0]; if (file) void openHandle({ name: file.name, getFile: async () => file }, true); event.currentTarget.value = ''; }}/>
    {diagramPreview && <DiagramDialog svg={diagramPreview} onClose={() => setDiagramPreview(null)}/>}
    {toast && <div class="toast" role="status"><Icon name="lock"/><span>{toast}</span><IconButton icon="close" label="关闭提示" onClick={() => setToast('')}/></div>}
  </div>;
}

render(<App/>, document.getElementById('app'));
