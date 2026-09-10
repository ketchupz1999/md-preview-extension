import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { isMarkdown, listDirectory } from './files.js';

function DirectoryRow({ entry, selectedPath, onOpen, showHidden, onError }) {
  const [expanded, setExpanded] = useState(selectedPath.startsWith(`${entry.path}/`));
  const [children, setChildren] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (selectedPath.startsWith(`${entry.path}/`)) setExpanded(true);
  }, [selectedPath, entry.path]);
  useEffect(() => {
    if (!expanded || children) return;
    let cancelled = false;
    listDirectory(entry.handle, entry.path, showHidden).then((result) => {
      if (!cancelled) { setChildren(result); setError(''); }
    }).catch(() => { if (!cancelled) setError('无法读取此目录，请检查权限。'); });
    return () => { cancelled = true; };
  }, [expanded, children, showHidden, entry.handle]);
  return <li>
    <button class="tree-row directory-row" title={entry.path} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      <Icon name="chevron" className={expanded ? 'chevron expanded' : 'chevron'}/><Icon name="folder"/><span>{entry.name}</span>
    </button>
    {expanded && (error ? <p class="tree-message">{error}</p> : children ? <FileTree entries={children} selectedPath={selectedPath} onOpen={onOpen} showHidden={showHidden} onError={onError}/> : <p class="tree-message">读取中…</p>)}
  </li>;
}

/** 目录逐级展开，避免打开知识库时递归扫描全部文件。 */
export function FileTree({ entries, selectedPath, onOpen, showHidden, onError }) {
  return <ul class="file-tree">
    {entries.map((entry) => entry.kind === 'directory' ? <DirectoryRow key={entry.path} {...{ entry, selectedPath, onOpen, showHidden, onError }}/> : <li key={entry.path}>
      <button class={`tree-row file-row ${selectedPath === entry.path ? 'selected' : ''}`} aria-current={selectedPath === entry.path ? 'page' : undefined} title={entry.path} onClick={() => onOpen(entry)}>
        {isMarkdown(entry.name) ? <span class="markdown-icon" aria-hidden="true">M<span>↓</span></span> : <Icon name="file"/>}<span>{entry.name}</span>
      </button>
    </li>)}
    {!entries.length && <li class="tree-message">此目录没有可见文件</li>}
  </ul>;
}

export function Outline({ headings, active, onJump }) {
  const minimum = Math.min(...headings.map((heading) => heading.level), 1);
  return <nav aria-label="文档大纲" class="outline">
    {headings.length ? headings.map((heading) => <button key={heading.id} class={`outline-item indent-${heading.level - minimum} ${active === heading.id ? 'active' : ''}`} aria-current={active === heading.id ? 'location' : undefined} onClick={() => onJump(heading.slug)} title={heading.text}>{heading.text}</button>) : <p class="tree-message">这份文档还没有标题</p>}
  </nav>;
}
