import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await mkdtemp(path.join(tmpdir(), 'markdown-local-files-'));
const notes = path.join(root, '知识库 示例');
await mkdir(path.join(notes, '子目录'), { recursive: true });
const initialFile = path.join(notes, '项目 说明.MD');
const initialSource = '# 项目说明\n\n## 功能\n\n自动读取文件目录。\n\n[同级文档](peer.md)\n\n[子目录文档](子目录/链接%20%23.md#API%20Usage)\n\n![本地图](image.png)\n\n```mermaid\nsequenceDiagram\n 用户->>阅读器: 打开 Markdown\n 阅读器-->>用户: 显示大纲和文件树\n```\n';
await writeFile(initialFile, initialSource);
await writeFile(path.join(notes, 'peer.md'), '# 同级文档\n\n[返回](项目%20说明.MD)\n');
await writeFile(path.join(notes, '子目录', '链接 #.md'), '# 子目录文档\n\n## API Usage\n\n[返回父目录](../项目%20说明.MD)\n');
await writeFile(path.join(notes, 'plain.txt'), '不应接管普通文本');
await writeFile(path.join(notes, 'page.html'), '<!doctype html><h1>普通 HTML</h1>');
await writeFile(path.join(notes, 'image.png'), await readFile('dist/icons/128.png'));
await mkdir('.test-output', { recursive: true });
const extensionPath = path.resolve('dist');
const browser = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true, viewport: { width: 1440, height: 1000 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
const outbound = [], errors = [], checks = [];
const passed = (message) => { checks.push(message); console.log(`PASS ${message}`); };
await browser.route(/^https?:\/\//, async (route) => { outbound.push(route.request().url()); await route.abort(); });
let page;
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const extensionURL = `chrome-extension://${id}/reader.html`;
  const settings = await browser.newPage();
  await settings.goto(`chrome://extensions/?id=${id}`);
  // CLI 可绕过开发者模式首次加载扩展；修改权限会重新校验，因此模拟实际安装步骤。
  const developerMode = settings.locator('extensions-toolbar #devMode');
  await developerMode.waitFor();
  if (await developerMode.getAttribute('aria-pressed') !== 'true') await developerMode.click();
  await expect(developerMode).toHaveAttribute('aria-pressed', 'true');
  const fileToggle = settings.locator('extensions-detail-view #allow-on-file-urls cr-toggle');
  await fileToggle.waitFor();
  if (await fileToggle.getAttribute('aria-pressed') !== 'true') await fileToggle.click();
  await expect(fileToggle).toHaveAttribute('aria-pressed', 'true');
  page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  async function openLocal(filename) {
    await page.goto(pathToFileURL(filename).href).catch((error) => { if (!error.message.includes('ERR_ABORTED')) throw error; });
  }
  await openLocal(initialFile);
  await expect(page).toHaveURL(new RegExp(`^chrome-extension://${id}/reader.html\\?file=`));
  await expect(page.locator('article h1')).toHaveText('项目说明');
  await expect(page.getByRole('navigation', { name: '文档大纲' })).toBeVisible();
  await expect(page.getByRole('searchbox', {name:'搜索文件名或路径'})).toBeHidden();
  await page.getByRole('tab', {name:'文件',exact:true}).click();
  await expect(page.getByRole('tabpanel', {name:'文件',exact:true})).toBeVisible();
  await expect(page.getByRole('button', { name: 'peer.md', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '项目 说明.MD', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => page.locator('article img').evaluate((image) => image.naturalWidth)).toBe(128);
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('.sidebar')).not.toContainText('全部免费');
  await expect(page.locator('.sidebar')).not.toContainText('仅在本地');
  await page.screenshot({ path: '.test-output/automatic-file.png' });
  passed('real file:// Markdown automatically opens with its parent tree, outline, image and Mermaid');

  await page.getByRole('button', { name: 'peer.md', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('同级文档');
  assert.equal(await page.evaluate(() => new URL(location.href).searchParams.get('file')), pathToFileURL(path.join(notes, 'peer.md')).href);
  await page.reload();
  await expect(page.locator('article h1')).toHaveText('同级文档');
  await page.getByRole('tab', {name:'文件',exact:true}).click();
  await expect(page.getByRole('button', { name: '项目 说明.MD', exact: true })).toBeVisible();
  passed('tree navigation updates the document URL and survives reload');

  await page.getByRole('link', { name: '返回', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('项目说明');
  await page.getByRole('link', { name: '子目录文档', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('子目录文档');
  await expect(page.locator('#doc-api-usage')).toBeVisible();
  await page.getByRole('link', { name: '返回父目录', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('项目说明');
  passed('Chinese / spaced / hash filenames, relative file links and parent links work');

  await writeFile(initialFile, initialSource.replace('自动读取文件目录。', '文件更新已自动显示。'));
  await expect(page.locator('article')).toContainText('文件更新已自动显示。', { timeout: 8000 });
  await writeFile(path.join(notes, 'new-file.md'), '# 新文件');
  await page.getByRole('button', { name: '刷新文件和目录', exact: true }).click();
  await expect(page.getByRole('button', { name: 'new-file.md', exact: true })).toBeVisible();
  passed('real disk edits refresh and new files appear in the parent tree');

  await openLocal(path.join(notes, '子目录', '链接 #.md'));
  await expect(page.locator('article h1')).toHaveText('子目录文档');
  await expect(page.locator('.files-section .section-heading')).toContainText('子目录');
  await page.getByRole('link', { name: '返回父目录', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('项目说明');
  await expect(page.locator('.files-section .section-heading')).toContainText('知识库 示例');
  passed('direct opening uses the current parent and parent links switch directories');

  await openLocal(path.join(notes, 'plain.txt'));
  await expect(page).toHaveURL(pathToFileURL(path.join(notes, 'plain.txt')).href);
  await expect(page.locator('body')).toContainText('不应接管普通文本');
  await openLocal(path.join(notes, 'page.html'));
  await expect(page.locator('h1')).toHaveText('普通 HTML');
  await expect(page).toHaveURL(pathToFileURL(path.join(notes, 'page.html')).href);
  passed('ordinary local text and HTML are not intercepted');

  await openLocal(initialFile);
  await expect(page.locator('article h1')).toHaveText('项目说明');
  await page.goBack().catch((error) => { if (!error.message.includes('ERR_ABORTED')) throw error; });
  await expect(page).toHaveURL(pathToFileURL(path.join(notes, 'page.html')).href);
  passed('browser Back leaves the reader without an automatic-preview loop');

  await settings.bringToFront();
  await fileToggle.click();
  await expect(fileToggle).toHaveAttribute('aria-pressed', 'false');
  await openLocal(initialFile);
  await expect(page).toHaveURL(pathToFileURL(initialFile).href);
  await expect(page.locator('body')).toContainText('# 项目说明');
  page = await browser.newPage();
  await expect(async () => { await page.goto(extensionURL); }).toPass({timeout:5000});
  await expect(page.getByRole('button', { name: '打开扩展设置', exact: true })).toBeVisible();
  passed('disabled file permission leaves files unchanged and offers the required setting');

  assert.deepEqual(outbound, []);
  assert.deepEqual(errors, []);
  await writeFile('.test-output/local-file-results.json', JSON.stringify({ browser: browser.browser()?.version(), checks, outbound, errors }, null, 2));
  console.log(`${checks.length} real-file checks passed; outbound requests: ${outbound.length}`);
} catch (error) {
  if (page) {
    await page.screenshot({ path: '.test-output/local-file-failure.png' });
    console.error(JSON.stringify({url:page.url(), errors, toast:await page.locator('.toast').allTextContents(), readerErrors:await page.locator('.document-error').allTextContents()}));
  }
  throw error;
} finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
