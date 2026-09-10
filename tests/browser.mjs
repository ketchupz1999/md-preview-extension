import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const extensionPath = path.resolve('dist');
await mkdir('.test-output', { recursive: true });
const browser = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
const results = [];
const outbound = [];
const errors = [];
let page;
const check = (name) => { results.push(name); console.log(`PASS ${name}`); };
await browser.route(/^https?:\/\//, async (route) => { outbound.push(route.request().url()); await route.abort(); });
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const url = new URL('reader.html', worker.url()).href;
  await page.goto(url);
  await expect(page.locator('article h1')).toHaveText('MD Preview');
  assert.equal(await page.evaluate(() => typeof showDirectoryPicker), 'function');
  check('real extension page loads with File System Access API');
  await expect(page.getByRole('tab', {name: /^大纲/})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('searchbox', {name:'搜索文件名或路径'})).toBeHidden();
  assert.ok(await page.locator('.sidebar').evaluate(e => e.getBoundingClientRect().width) <= 240);

  const examples = await Promise.all(['README.md', 'notes/离线与隐私.md', 'notes/验证清单.md', 'notes/图表与时序.md'].map(async (name) => ({ name, source: await readFile(`examples/${name}`, 'utf8') })));
  examples[0].source += '\n\n[本地图片测试](notes/本地图片.md#API%20Usage)';
  examples.push({ name: 'notes/本地图片.md', source: '# 本地图片\n\n[跳到 API 说明](#API%20Usage)\n\n![高图片](../images/local.png)\n\n## API Usage\n\n图片解码后再定位。\n\n' + '阅读内容。\n\n'.repeat(30) });
  // 仅用测试脚本替代系统选择器；其余读目录、文件、持久化均使用真实 FileSystemHandle。
  await page.evaluate(async (files) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('文档示例', { create: true });
    const imageDirectory = await root.getDirectoryHandle('images', { create: true });
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 2600;
    const context = canvas.getContext('2d'); context.fillStyle = '#e9edf9'; context.fillRect(0, 0, 600, 2600);
    const image = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const imageFile = await imageDirectory.getFileHandle('local.png', { create: true });
    const imageWriter = await imageFile.createWritable(); await imageWriter.write(image); await imageWriter.close();
    for (const { name, source } of files) {
      const parts = name.split('/');
      let directory = root;
      for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
      const file = await directory.getFileHandle(parts.at(-1), { create: true });
      const writer = await file.createWritable(); await writer.write(source); await writer.close();
    }
    window.showDirectoryPicker = async (options) => {
      if (options.mode !== 'read') throw new Error('must request read-only');
      return root;
    };
  }, examples);
  await page.getByRole('button', { name: '打开文件夹', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('本地文档阅读器 · 设计笔记');
  await page.getByRole('tab', {name:'文件',exact:true}).click();
  await expect(page.getByRole('button', { name: 'README.md', exact: true })).toHaveAttribute('aria-current', 'page');
  check('folder selection, real handle enumeration and default README');
  await page.getByRole('tab', {name:/^大纲/}).click();
  await page.screenshot({ path: '.test-output/reader.png' });
  await page.getByRole('tab', {name:'文件',exact:true}).click();

  await page.getByRole('button', { name: 'notes', exact: true }).click();
  await expect(page.getByRole('button', { name: '离线与隐私.md', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '离线与隐私.md', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('离线与隐私');
  await expect(page.locator('.image-placeholder')).toContainText('远程图片已拦截');
  assert.equal(await page.locator('article img, article script, article iframe').count(), 0);
  check('lazy subdirectory browsing and remote image / HTML blocking');

  await page.getByRole('link', { name: '返回设计笔记' }).click();
  await expect(page.locator('article h1')).toHaveText('本地文档阅读器 · 设计笔记');
  await expect.poll(() => page.locator('.reading-pane').evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  check('relative Markdown link resolves and jumps to heading');

  await page.getByRole('link', { name: '本地图片测试', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('本地图片');
  await expect.poll(() => page.locator('article img').evaluate((image) => image.naturalHeight)).toBe(2600);
  await expect.poll(() => page.locator('#doc-api-usage').evaluate((heading) => Math.round(heading.getBoundingClientRect().top))).toBeLessThan(160);
  await page.getByRole('link', { name: '跳到 API 说明', exact: true }).click();
  await expect.poll(() => page.locator('#doc-api-usage').evaluate((heading) => Math.round(heading.getBoundingClientRect().top))).toBeLessThan(160);
  const imageScroll = await page.locator('.reading-pane').evaluate((element) => element.scrollTop);
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise((resolve) => { const request = indexedDB.open('local-markdown', 1); request.onsuccess = () => resolve(request.result); });
    return new Promise((resolve) => { const request = db.transaction('session').objectStore('session').get('current'); request.onsuccess = () => { resolve(request.result?.top || 0); db.close(); }; });
  })).toBe(imageScroll);
  await page.reload();
  await expect(page.locator('article h1')).toHaveText('本地图片');
  await expect.poll(() => page.locator('article img').evaluate((image) => image.naturalHeight)).toBe(2600);
  await expect.poll(async () => Math.abs(await page.locator('.reading-pane').evaluate((element) => element.scrollTop) - imageScroll)).toBeLessThan(100);
  check('local image decoding, mixed-case / spaced anchors and image-aware scroll restoration');

  await page.getByRole('tab', {name:'文件',exact:true}).click();
  await page.getByRole('searchbox', { name: '搜索文件名或路径' }).fill('图表');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await page.locator('.search-result').click();
  await expect(page.locator('article h1')).toHaveText('图表与时序');
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(4, { timeout: 30000 });
  assert.equal(await page.locator('.diagram-error').count(), 0);
  await expect(page.locator('.diagram-canvas').first()).toContainText('所有处理均在当前设备完成');
  check('Chinese search, sequence, flowchart, state and ER diagrams render offline');
  await expect(page.getByRole('tabpanel', {name:'文件',exact:true})).toBeVisible();
  await page.getByRole('tab', {name:/^大纲/}).click();
  await expect(page.getByRole('navigation', { name: '文档大纲' })).toBeVisible();
  await page.getByRole('button', { name: '文件读取时序', exact: true }).click();
  await page.screenshot({ path: '.test-output/mermaid.png' });

  await page.locator('[data-expand-diagram="0"]').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.getByRole('button', { name: '放大图表', exact: true }).click();
  await expect(page.locator('.diagram-zoom>svg')).toBeVisible();
  assert.ok(await page.locator('.diagram-zoom>svg').evaluate((element) => element.getBoundingClientRect().width) > 600);
  await page.screenshot({ path: '.test-output/sequence-expanded.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toHaveCount(0);
  check('diagram enlargement, zoom and Escape close');

  await page.getByRole('button', { name: '查看源码', exact: true }).click();
  await expect(page.locator('.source-code')).toContainText('sequenceDiagram');
  await page.getByRole('button', { name: '显示阅读视图', exact: true }).click();
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(4, { timeout: 30000 });
  await page.getByRole('button', { name: '切换深色主题', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(4);
  await expect.poll(() => page.locator('.mermaid-scratch').count()).toBe(0);
  await expect.poll(() => page.locator('.diagram-canvas .messageText').first().evaluate((element) => getComputedStyle(element).fill)).toBe('rgb(211, 211, 211)');
  await page.screenshot({ path: '.test-output/dark.png' });
  await page.getByRole('button', { name: '切换浅色主题', exact: true }).click();
  check('source toggle and light / dark Mermaid rendering');

  await page.getByRole('button', { name: '数据关系', exact: true }).click();
  const previousScroll = await page.locator('.reading-pane').evaluate((element) => element.scrollTop);
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise((resolve) => { const request = indexedDB.open('local-markdown', 1); request.onsuccess = () => resolve(request.result); });
    return new Promise((resolve) => { const request = db.transaction('session').objectStore('session').get('current'); request.onsuccess = () => { resolve(request.result?.top || 0); db.close(); }; });
  })).toBe(previousScroll);
  await page.reload();
  await expect(page.locator('article h1')).toHaveText('图表与时序');
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(4, { timeout: 30000 });
  await expect.poll(async () => Math.abs(await page.locator('.reading-pane').evaluate((element) => element.scrollTop) - previousScroll)).toBeLessThan(100);
  check('IndexedDB restores directory, file and reading position after reload');

  await page.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('文档示例');
    const dir = await root.getDirectoryHandle('notes');
    const handle = await dir.getFileHandle('图表与时序.md');
    const file = await handle.getFile(); const source = await file.text();
    const writer = await handle.createWritable(); await writer.write(source + '\n\n自动刷新验证成功。'); await writer.close();
  });
  await expect(page.locator('article')).toContainText('自动刷新验证成功。', { timeout: 7000 });
  check('changes on a real file handle automatically refresh');

  await page.locator('input[type="file"]').setInputFiles({ name: 'attack.md', mimeType: 'text/markdown', buffer: Buffer.from('# 安全测试\n\n![track](https://track.invalid/leak)\n\n<script>window.leaked=true</script>\n\n```mermaid\n%%{init: {"securityLevel":"loose", "themeCSS":"@import url(https://track.invalid/a.css)"}}%%\nflowchart LR\nA[Local]-->B[Reader]\nclick A "https://track.invalid/?secret=sample"\n```\n\n[external](https://track.invalid/leak)') });
  await expect(page.locator('article h1')).toHaveText('安全测试');
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(1, { timeout: 30000 });
  assert.equal(await page.locator('article img, article script, article iframe, article svg a, article svg image').count(), 0);
  assert.equal(await page.locator('article [href^="http"]').count(), 0);
  assert.equal(await page.evaluate(() => window.leaked), undefined);
  assert.deepEqual(outbound, []);
  check('malicious Mermaid directives / click links and raw HTML stay inert; zero outbound requests');

  const blocked = await page.evaluate(async () => {
    try { await fetch('https://network-probe.invalid/'); return false; } catch { return true; }
  });
  assert.equal(blocked, true);
  assert.deepEqual(outbound, []);
  check('browser CSP blocks direct outbound fetch before network dispatch');
  assert.deepEqual(errors, []);
  await writeFile('.test-output/browser-results.json', JSON.stringify({ browser: browser.browser()?.version(), extensionURL: url, passed: results, outboundRequests: outbound, pageErrors: errors }, null, 2));
  console.log(`\n${results.length} browser checks passed; outbound requests: ${outbound.length}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: '.test-output/failure.png' });
    console.error(JSON.stringify({ pageErrors: errors, diagramErrors: await page.locator('.diagram-error').allTextContents(), toast: await page.locator('.toast').allTextContents() }));
  }
  throw error;
} finally { await browser.close(); }
