const paths = {
  folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></>,
  file: <><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z"/><path d="M13 3v7h7M8 15h8M8 18h5"/></>,
  outline: <><path d="M5 5h14M5 10h10M5 15h14M5 20h7"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  back: <path d="m14 6-6 6 6 6"/>,
  next: <path d="m10 6 6 6-6 6"/>,
  refresh: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
  moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>,
  code: <><path d="m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16"/></>,
  settings: <><path d="M3 6h5M12 6h9M3 12h10M17 12h4M3 18h2M9 18h12"/><path d="M8 3v6M13 9v6M9 15v6"/></>,
  plus: <path d="M12 4v16M4 12h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4"/></>,
};

/** 统一的本地图标，不依赖图标 CDN。 */
export function Icon({ name, className = '' }) {
  return <svg class={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}

export function IconButton({ icon, label, className = '', ...props }) {
  return <button class={`icon-button ${className}`} type="button" title={label} aria-label={label} {...props}><Icon name={icon}/></button>;
}
