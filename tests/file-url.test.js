import test from 'node:test';
import assert from 'node:assert/strict';
import { localFileURL, isLocalMarkdownURL, localFileReference } from '../src/file-url-policy.js';
import { parseDirectoryListing, LocalURLDirectory } from '../src/file-url.js';
import { parseMarkdown } from '../src/markdown.js';

test('automatic preview only accepts local Markdown, never remote or network shares', () => {
  for (const url of ['file:///tmp/README.md', 'file:///tmp/中文%20说明.MD#title', 'file:///tmp/note.markdown']) assert.equal(isLocalMarkdownURL(url), true, url);
  for (const url of ['https://example.com/a.md', 'http://localhost/a.md', 'file://server/share/a.md', 'file:////server/share/a.md', 'file:///tmp/a.png', 'file:///tmp/a.html', 'file:///tmp/a.md.exe', 'file:///tmp/a%2fb.md', 'file:///tmp/a%5cb.md', 'file:///tmp/a%00.md']) assert.equal(isLocalMarkdownURL(url), false, url);
  assert.equal(localFileURL('file:///tmp/a.md?query#title'), 'file:///tmp/a.md');
});

test('directory rows are parsed as data and cannot point outside their parent', () => {
  const html = 'function addRow(){}\n<script>addRow("目录","%E7%9B%AE%E5%BD%95",1,1,"1 B",0,"");</script>\n<script>addRow("a b.md","a%20b.md",0,3,"3 B",0,"");</script>\n<script>addRow("evil.md","https://evil.invalid/a.md",0,1,"1 B",0,"");</script>\n<script>addRow("escape.md","../escape.md",0,1,"1 B",0,"");</script>\n<script>addRow("execute.md",(globalThis.compromised=true),0);</script>';
  const entries = parseDirectoryListing(html, 'file:///tmp/notes/');
  assert.deepEqual(entries, [{name:'目录',kind:'directory',url:'file:///tmp/notes/%E7%9B%AE%E5%BD%95/'},{name:'a b.md',kind:'file',url:'file:///tmp/notes/a%20b.md'}]);
  assert.equal(globalThis.compromised, undefined);
  assert.throws(() => parseDirectoryListing('not a directory', 'file:///tmp/'));
});

test('local file references allow parent documents and images without enabling remote resources', () => {
  assert.deepEqual(localFileReference('file:///tmp/notes/a.md', '../README.md#API%20Usage'), {url:'file:///tmp/README.md',heading:'API Usage'});
  assert.equal(localFileReference('file:///tmp/a.md', '//server/share/a.md'), null);
  const parsed = parseMarkdown('[up](../README.md#API%20Usage)\n![local](../image.png)\n![remote](https://remote.invalid/image.png)', 'a.md', 'file:///tmp/notes/a.md');
  assert.match(parsed.html, /data-file-url="file:\/\/\/tmp\/README.md"/);
  assert.match(parsed.html, /data-heading="api-usage"/);
  assert.equal(parsed.images[0].url, 'file:///tmp/image.png');
  assert.equal(parsed.blockedImages, 1);
});

test('URL directory handles reject unsafe child names and expose no write operations', async () => {
  const root = new LocalURLDirectory('file:///tmp/');
  const file = await root.getFileHandle('a #.md');
  assert.equal(file.url, 'file:///tmp/a%20%23.md');
  assert.deepEqual(await root.resolve(file), ['a #.md']);
  assert.equal(file.createWritable, undefined);
  await assert.rejects(root.getFileHandle('../escape.md'));
  await assert.rejects(root.getDirectoryHandle('a/b'));
});
