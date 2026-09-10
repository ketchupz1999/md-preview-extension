export const MAX_TEXT_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const isMarkdown = (name) => /\.(md|markdown|mdown|mkd|mdx)$/i.test(name);
export const isImage = (name) => /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i.test(name);
export const isText = (name) => isMarkdown(name) || /\.(txt|log|json|ya?ml|toml|ini|csv|tsv|xml|html?|css|s[ac]ss|js|jsx|ts|tsx|mjs|cjs|py|go|rs|sh|bash|zsh|sql|java|kt|swift|c|h|cpp|hpp|rb|php|vue|svelte|conf|env|gitignore)$/i.test(name) || /^(readme|license|licence|makefile|dockerfile|changelog|\.gitignore|\.env)$/i.test(name);
const skippedDirectories = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__']);
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

/** 将文档相对链接限制在用户已授权的目录内。 */
export function resolveLocalPath(currentPath, target) {
  if (typeof target !== 'string' || !target || /[\u0000-\u001f\u007f\\]/.test(target)) return null;
  const hashIndex = target.indexOf('#');
  const pathname = hashIndex < 0 ? target : target.slice(0, hashIndex);
  let decoded, heading;
  try {
    decoded = decodeURIComponent(pathname);
    heading = hashIndex < 0 ? '' : decodeURIComponent(target.slice(hashIndex + 1));
  } catch { return null; }
  if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || /^[\/\\]/.test(decoded) || /[\u0000-\u001f\u007f\\?]/.test(decoded)) return null;
  if (!decoded) return { path: currentPath, heading };
  const parts = currentPath.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? { path: parts.join('/'), heading } : null;
}

/** 按需读取一层目录，不读取任何文件正文。 */
export async function listDirectory(handle, path = '', showHidden = false) {
  const entries = [];
  for await (const [name, child] of handle.entries()) {
    if (!showHidden && name.startsWith('.')) continue;
    entries.push({ name, path: path ? `${path}/${name}` : name, handle: child, kind: child.kind });
  }
  return entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'directory' ? -1 : 1) || collator.compare(a.name, b.name));
}

/** 从授权根目录逐级定位文件，永不申请写入或创建权限。 */
export async function findFile(root, path) {
  if (!root) throw new Error('请先打开此文件所在的文件夹，再访问相对链接或图片。');
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\\\u0000]/.test(part))) throw new Error('文件路径无效。');
  let parent = root;
  for (const part of parts.slice(0, -1)) parent = await parent.getDirectoryHandle(part);
  return parent.getFileHandle(parts.at(-1));
}

/** 有上限地搜索文件名；取消后停止继续遍历。 */
export async function searchDirectory(root, query, showHidden, signal) {
  const pending = [{ handle: root, path: '' }];
  const results = [];
  let visited = 0, skipped = 0;
  const normalized = query.toLocaleLowerCase();
  while (pending.length) {
    if (signal.aborted) return null;
    const directory = pending.pop();
    try {
      for await (const [name, handle] of directory.handle.entries()) {
        if (signal.aborted) return null;
        if (++visited > 20000) return { results, limited: true, skipped };
        if (!showHidden && name.startsWith('.')) continue;
        const path = directory.path ? `${directory.path}/${name}` : name;
        if (handle.kind === 'directory') {
          if (!skippedDirectories.has(name)) pending.push({ handle, path });
        } else if (path.toLocaleLowerCase().includes(normalized)) {
          results.push({ name, path, handle, kind: 'file' });
          if (results.length >= 150) return { results, limited: true, skipped };
        }
      }
    } catch { skipped++; }
  }
  return { results: results.sort((a, b) => collator.compare(a.path, b.path)), limited: false, skipped };
}

/** 仅在当前浏览器保存文件句柄和阅读位置，不缓存文档内容。 */
export async function savedSession(value) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('local-markdown', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('session', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('session');
      const request = value === undefined ? store.get('current') : value === null ? store.delete('current') : store.put(value, 'current');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
