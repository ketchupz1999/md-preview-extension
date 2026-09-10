import { chromium, expect } from '@playwright/test';
import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('docs/chrome-store/assets');
await mkdir(output, { recursive: true }); await mkdir('examples/images', { recursive: true });
await cp('public/icons/128.png', 'examples/images/md-preview.png');
const filenames = ['README.md', 'notes/离线与隐私.md', 'notes/验证清单.md', 'notes/图表与时序.md', 'preview.html', 'styles/preview.css', 'images/md-preview.png'];
const fixtures = await Promise.all(filenames.map(async (name) => ({ name, bytes: (await readFile(`examples/${name}`)).toString('base64') })));
const extension = path.resolve('dist');
const browser = await chromium.launchPersistentContext('', {
  channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const outbound = [];
await browser.route(/^https?:\/\//, async (route) => { outbound.push(route.request().url()); await route.abort(); });
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  const page = await browser.newPage();
  await page.goto(new URL('reader.html', worker.url()).href);
  await expect(page.locator('article h1')).toHaveText('MD Preview');
  // 仅为演示截图准备隔离的本地文件句柄，不访问用户文档或引入产品测试入口。
  await page.evaluate(async (files) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('MD Preview Examples', { create: true });
    for (const { name, bytes } of files) {
      const parts = name.split('/'); let directory = root;
      for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
      const handle = await directory.getFileHandle(parts.at(-1), { create: true });
      const stream = await handle.createWritable();
      await stream.write(Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0))); await stream.close();
    }
    window.showDirectoryPicker = async () => root;
  }, fixtures);
  await page.getByRole('button', { name: '打开文件夹', exact: true }).click();
  await expect(page.locator('article h1')).toHaveText('本地文档阅读器 · 设计笔记');
  await page.screenshot({ path: path.join(output, '01-reading-1280x800.png') });
  await page.getByRole('tab', { name: '文件', exact: true }).click();
  await page.getByRole('button', { name: 'notes', exact: true }).click();
  await expect(page.getByRole('button', { name: '图表与时序.md', exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, '02-files-1280x800.png') });
  await page.getByRole('button', { name: '图表与时序.md', exact: true }).click();
  await expect(page.locator('.diagram-canvas svg')).toHaveCount(4, { timeout: 30000 });
  await page.getByRole('tab', { name: /^大纲/ }).click();
  await page.getByRole('button', { name: '文件读取时序', exact: true }).click();
  await page.screenshot({ path: path.join(output, '03-mermaid-1280x800.png') });
  await page.locator('[data-expand-diagram="0"]').click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.screenshot({path:'docs/screenshots/sequence-expanded.png'});
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换深色主题', exact: true }).click();
  await expect.poll(() => page.locator('.diagram-canvas .messageText').first().evaluate((element) => getComputedStyle(element).fill)).toBe('rgb(211, 211, 211)');
  await page.screenshot({ path: path.join(output, '04-dark-1280x800.png') });
  await page.getByRole('button', { name: '切换浅色主题', exact: true }).click();
  await page.getByRole('tab', { name: '文件', exact: true }).click();
  await page.getByRole('button', { name: 'preview.html', exact: true }).click();
  await expect(page.frameLocator('.html-preview').locator('h1')).toHaveText('文档，直接预览。');
  await page.getByRole('tab', { name: /^大纲/ }).click();
  await page.screenshot({ path: path.join(output, '05-html-1280x800.png') });
  if (outbound.length) throw new Error('Screenshot rendering attempted an external request.');
  for (const name of ['01-reading', '02-files', '03-mermaid', '04-dark', '05-html']) {
    const file = await readFile(path.join(output, `${name}-1280x800.png`));
    if (file.readUInt32BE(16) !== 1280 || file.readUInt32BE(20) !== 800 || file[25] !== 2) throw new Error(`Unexpected screenshot format: ${name}`);
  }
  await cp(path.join(output, '01-reading-1280x800.png'), 'docs/screenshots/reader.png');
  await cp(path.join(output, '02-files-1280x800.png'), 'docs/screenshots/automatic-file.png');
  await cp(path.join(output, '03-mermaid-1280x800.png'), 'docs/screenshots/mermaid.png');
  await cp(path.join(output, '05-html-1280x800.png'), 'docs/screenshots/html-preview.png');
  console.log('Five Chrome Web Store screenshots generated: 1280×800, RGB PNG, zero external requests.');
} finally { await browser.close(); }
