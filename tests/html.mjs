import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await mkdtemp(path.join(tmpdir(), 'markdown-html-'));
await writeFile(path.join(root, 'README.md'), '# 阅读示例\n\n[HTML 设计文档](preview.html)\n\n[跳到 HTML 章节](preview.html#Install.API)');
await writeFile(path.join(root, 'theme.css'), 'body { background: #f4f8fe; color: #243348; } .hero { color: #2563eb; display: grid; grid-template-columns: 1fr 160px; gap: 40px; } .tile { width: 40px; height: 40px; background-image: url("./tile.png"); background-size: cover; } .sidebar { display: none !important; } /* </style><img id="css-injected" src="https://tracker.invalid/css-injection"><style> */');
await writeFile(path.join(root, 'tile.png'), await readFile('dist/icons/128.png'));
await writeFile(path.join(root, 'preview.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>设计文档</title>
<link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bad">
<style>body{margin:0;padding:56px;font-family:system-ui,sans-serif;line-height:1.8}.kicker{font-size:12px;letter-spacing:2px;color:#7286a4}h1{font-size:40px;line-height:1.3;letter-spacing:-1px;margin:28px 0}h2{font-size:24px;margin:40px 0 18px}p{max-width:640px}section{padding:20px 0 100px;border-bottom:1px solid #d9e2f1}.hero img{width:128px;border-radius:14px;margin-top:50px}.label{color:#617490}.actions{display:flex;gap:16px}button{background:#2563eb;color:white;border:0;border-radius:6px;padding:12px 20px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;border-bottom:1px solid #d9e2f1;padding:14px}.remote{background-image:url(https://tracker.invalid/css.png)}</style>
<meta http-equiv="refresh" content="0;url=https://tracker.invalid/refresh"></head><body>
<span class="kicker">DESIGN NOTE / 01</span><section class="hero"><div><h1 id="hero-title">设计文档，直接阅读。</h1><p>HTML 的排版、颜色与本地样式在阅读器里呈现。正文仍然留在设备上。</p><div class="actions"><button onclick="parent.compromised=true">示例按钮</button><span class="label">静态页面预览</span></div></div><img src="tile.png" alt="本地图标"></section>
<section><h2>功能一览</h2><table><tr><th>内容</th><th>预览方式</th></tr><tr><td>HTML 页面</td><td>保留布局与内嵌样式</td></tr><tr><td>本地 CSS</td><td>直接读取样式文件</td></tr><tr><td>远程资源</td><td>不加载</td></tr></table><div class="tile"></div></section>
<section><h2 id="Install.API">使用方式</h2><p>在文件 Tab 中选择 HTML 文件即可预览，也可以切换到源码。</p><a href="https://tracker.invalid/link" ping="https://tracker.invalid/ping">外部链接</a><img src="https://tracker.invalid/image" onerror="parent.compromised=true"><iframe src="https://tracker.invalid/frame"></iframe><form action="https://tracker.invalid/form"><input name="secret" value="test"></form></section>
<script>parent.compromised=true;fetch('https://tracker.invalid/script')</script></body></html>`);
await mkdir('.test-output', {recursive:true});
const extension = path.resolve('dist');
const browser = await chromium.launchPersistentContext('', {channel:'chromium',executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
const outbound=[], errors=[], checks=[];
const passed=(name)=>{checks.push(name);console.log(`PASS ${name}`);};
await browser.route(/^https?:\/\//, async route=>{outbound.push(route.request().url());await route.abort();});
let page;
try {
  const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker');
  page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('reader.html',worker.url()).href+'?file='+encodeURIComponent(pathToFileURL(path.join(root,'README.md')).href));
  await expect(page.locator('article h1')).toHaveText('阅读示例');
  await expect(page.getByRole('tab',{name:/^大纲/})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('searchbox',{name:'搜索文件名或路径'})).toBeHidden();
  assert.ok(await page.locator('.sidebar').evaluate(e=>e.getBoundingClientRect().width)<=240);
  passed('narrow sidebar defaults to outline and hides file search');

  await page.getByRole('link',{name:'HTML 设计文档',exact:true}).click();
  const preview=page.frameLocator('.html-preview');
  await expect(preview.locator('h1')).toHaveText('设计文档，直接阅读。');
  await expect(preview.locator('h1')).toHaveAttribute('id','hero-title');
  await expect.poll(()=>preview.locator('.hero').evaluate(e=>getComputedStyle(e).display)).toBe('grid');
  assert.equal(await preview.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(244, 248, 254)');
  assert.equal(await page.locator('.sidebar').evaluate(e=>getComputedStyle(e).display),'flex');
  await expect.poll(()=>preview.locator('img[alt="本地图标"]').evaluate(e=>e.naturalWidth)).toBe(128);
  assert.match(await preview.locator('.tile').evaluate(e=>getComputedStyle(e).backgroundImage),/^url\("blob:/);
  await page.screenshot({path:'.test-output/html-preview.png'});
  passed('HTML renders inline CSS, local stylesheets, images and CSS backgrounds without affecting reader styles');

  await page.getByRole('button',{name:'上一份文档',exact:true}).click();
  await expect(page.locator('article h1')).toHaveText('阅读示例');
  await page.getByRole('link',{name:'跳到 HTML 章节',exact:true}).click();
  await expect(preview.locator('[id="Install.API"]')).toHaveText('使用方式');
  await expect.poll(()=>page.locator('.html-preview').evaluate(e=>e.contentWindow.scrollY)).toBeGreaterThan(100);
  const previewScroll = await page.locator('.html-preview').evaluate(e=>e.contentWindow.scrollY);
  await page.getByRole('button',{name:'查看源码',exact:true}).click();
  await expect(page.locator('.source-code')).toContainText('<!doctype html>');
  await page.getByRole('button',{name:'显示阅读视图',exact:true}).click();
  await expect(preview.locator('h1')).toHaveText('设计文档，直接阅读。');
  await expect.poll(async()=>Math.abs(await page.locator('.html-preview').evaluate(e=>e.contentWindow.scrollY)-previewScroll)).toBeLessThan(5);
  passed('explicit HTML ID links and source / preview switching preserve the reading position');

  assert.equal(await preview.locator('script,iframe,link,meta[http-equiv="refresh"],a[href],[onerror],[onclick]').count(),0);
  assert.equal(await preview.locator('#css-injected').count(),0);
  await expect(preview.getByRole('button',{name:'示例按钮'})).toBeDisabled();
  assert.equal(await page.evaluate(()=>window.compromised),undefined);
  assert.equal(await page.locator('.html-preview').getAttribute('sandbox'),'allow-same-origin');
  assert.match(await preview.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),/script-src 'none'/);
  assert.deepEqual(outbound,[]);
  passed('HTML scripts, frames, external resources, links and forms stay inactive with zero outbound requests');

  await page.getByRole('tab',{name:'文件',exact:true}).click();
  await page.getByRole('button',{name:'theme.css',exact:true}).click();
  await expect(page.locator('.source-code')).toContainText('.hero');
  assert.ok(await page.locator('.css-color').count()>=2);
  await page.getByRole('button',{name:'阅读设置',exact:true}).click();
  await page.getByLabel('文字大小').selectOption('20');
  await expect(page.locator('.app')).toHaveClass(/text-size-20/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.font-button')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'刷新文件和目录'})).toHaveText('刷新');
  passed('CSS includes color previews; font size moves into settings and toolbar actions have visible labels');
  assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  await writeFile('.test-output/html-results.json',JSON.stringify({checks,outbound,errors},null,2));
  console.log(`${checks.length} HTML / layout checks passed`);
} catch(error) {
  if(page){await page.screenshot({path:'.test-output/html-failure.png'});console.error(JSON.stringify({errors,outbound,toast:await page.locator('.toast').allTextContents(),readerErrors:await page.locator('.document-error').allTextContents()}));}
  throw error;
} finally {await browser.close();await rm(root,{recursive:true,force:true});}
