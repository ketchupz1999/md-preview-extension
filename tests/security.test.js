import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMarkdown } from '../src/markdown.js';
import { resolveLocalPath, findFile, searchDirectory } from '../src/files.js';

test('manifest has only local file access and no remote hosts or elevated permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url)));
  for (const key of ['permissions', 'optional_permissions', 'optional_host_permissions', 'externally_connectable', 'update_url']) assert.equal(manifest[key], undefined, key);
  assert.deepEqual(manifest.host_permissions, ['file:///*']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['file:///*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ['reader.html'], matches: ['file:///*'] }]);
  const csp = manifest.content_security_policy.extension_pages;
  for (const directive of ["default-src 'none'", "connect-src file:", "script-src 'self'", "object-src 'none'", "frame-src 'self'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(`${directive};`), directive);
  assert.doesNotMatch(csp, /https?:|unsafe-eval|data:/);
  assert.equal(csp.match(/script-src ([^;]+)/)[1], "'self'");
  assert.ok(csp.includes("frame-ancestors 'none'"));
});

test('raw HTML, active content and tracking resources cannot become live markup', () => {
  const result = parseMarkdown('# 安全\n<script>alert(1)</script>\n<img src="https://tracker.test/a" onerror="alert(1)">\n<iframe src="https://tracker.test"></iframe>\n<style>@import "https://tracker.test";</style>\n\n![track](https://tracker.test/a.png)\n![svg](./active.svg)\n[x](javascript:alert%281%29)', 'README.md');
  assert.doesNotMatch(result.html, /<(script|img|iframe|style)\b/i);
  assert.doesNotMatch(result.html, /href="(?:javascript|https?):/i);
  assert.equal(result.blockedImages, 2);
  assert.equal(result.images.length, 0);
});

test('external links have no navigable href even for protocol-relative or encoded schemes', () => {
  const result = parseMarkdown('[remote](https://example.com/?secret=sample)\n[remote2](//example.com)\n[email](mailto:user@example.com)\n[encoded](https%3A%2F%2Fexample.com)\n[local](notes/intro.md#你好)', 'README.md');
  assert.equal((result.html.match(/data-external-url=/g) || []).length, 4);
  assert.equal((result.html.match(/href=/g) || []).length, 1);
  assert.match(result.html, /data-local-path="notes\/intro.md"/);
  assert.match(result.html, /data-heading="你好"/);
});

test('local references cannot escape the selected root or resolve to network URLs', () => {
  for (const target of ['../../secret.md', '/etc/passwd', '//host/a.md', 'file:///etc/passwd', 'https://host/a.md', 'https%3A%2F%2Fhost/a.md', '%2f%2fhost/a', '..\\secret.md', '%00.md', '%0ahttps://host/a', '%5c%5chost/file', '../%2e%2e/secret', 'a.md?query=1', '%zz']) assert.equal(resolveLocalPath('notes/readme.md', target), null, target);
  assert.deepEqual(resolveLocalPath('notes/readme.md', '../images/hello%20world.png'), { path: 'images/hello world.png', heading: '' });
  assert.deepEqual(resolveLocalPath('notes/readme.md', '#中文标题'), { path: 'notes/readme.md', heading: '中文标题' });
});

test('file lookup never creates a directory or file', async () => {
  const calls = [];
  const root = { getDirectoryHandle: async (...args) => { calls.push(args); return root; }, getFileHandle: async (...args) => { calls.push(args); return 'file'; } };
  assert.equal(await findFile(root, 'notes/readme.md'), 'file');
  assert.deepEqual(calls, [['notes'], ['readme.md']]);
  await assert.rejects(findFile(root, '../secret.md'));
  await assert.rejects(findFile(null, 'notes.md'));
});

test('local images stay unresolved until read from the authorized filesystem', () => {
  const result = parseMarkdown('![my image](../images/a.png)\n![escape](../../secret.png)', 'notes/readme.md');
  assert.doesNotMatch(result.html, /<img/);
  assert.equal(result.images[0].path, 'images/a.png');
  assert.equal(result.blockedImages, 1);
});

test('heading IDs are unique and cannot collide with the application', () => {
  const result = parseMarkdown('# app\n# 你好 世界\n## Same\n## Same\n## Same-1\n## Same\n\n- [x] done\n- [ ] later\n\n| a | b |\n| - | - |\n| 1 | 2 |', 'README.md');
  const ids = result.headings.map((heading) => heading.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('doc-')));
  assert.ok(ids.includes('doc-你好-世界'));
  assert.match(result.html, /☑ done/);
  assert.match(result.html, /<table>/);
});

test('written heading fragments normalize like headings, including duplicate slugs', () => {
  const result = parseMarkdown('# API Usage\n# API Usage\n# API-Usage-1\n\n[one](#API%20Usage) [two](#api-usage-1) [three](other.md#API%20Usage)', 'README.md');
  assert.deepEqual(result.headings.map((heading) => heading.id), ['doc-api-usage', 'doc-api-usage-1', 'doc-api-usage-1-1']);
  assert.equal((result.html.match(/data-heading="api-usage"/g) || []).length, 2);
  assert.match(result.html, /data-heading="api-usage-1"/);
});

test('code is escaped and highlight markup contains no executable content', () => {
  const result = parseMarkdown('```html\n<script src="https://evil.test"></script>\n```\n\n```unknown\n<img src=x onerror=alert(1)>\n```', 'README.md');
  assert.doesNotMatch(result.html, /<(script|img)\b/);
  assert.match(result.html, /&lt;/);
});

test('search is cancellable and does not read file bodies', async () => {
  const file = { kind: 'file', getFile: () => { throw new Error('search must not read contents'); } };
  const directory = { kind: 'directory', async *entries() { yield ['readme.md', file]; yield ['notes.md', file]; } };
  const result = await searchDirectory(directory, 'read', false, new AbortController().signal);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].path, 'readme.md');
  const controller = new AbortController(); controller.abort();
  assert.equal(await searchDirectory(directory, 'read', false, controller.signal), null);
});
