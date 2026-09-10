import test from 'node:test';
import assert from 'node:assert/strict';
import { safeDiagramSource } from '../src/diagram-policy.js';
import { parseMarkdown } from '../src/markdown.js';

test('Mermaid blocks are preserved for offline rendering with readable source', () => {
  const source = '# 图表\n\n```mermaid\nsequenceDiagram\n  用户->>阅读器: 打开文件\n```\n';
  const result = parseMarkdown(source, 'README.md');
  assert.equal(result.diagrams.length, 1);
  assert.match(result.html, /data-diagram-slot="0"/);
  assert.match(result.html, /放大查看/);
  assert.match(result.html, /用户-&gt;&gt;阅读器/);
});

test('document-supplied config cannot loosen Mermaid security or fetch remote CSS', () => {
  const source = '---\nconfig:\n  securityLevel: loose\n  themeCSS: "@import url(https://tracker.test/a.css)"\n---\n%%{init: {"securityLevel": "loose"}}%%\nflowchart LR\n A-->B';
  const clean = safeDiagramSource(source);
  assert.doesNotMatch(clean, /loose|https:|themeCSS|%%\{/);
  assert.match(clean, /flowchart LR/);
  assert.throws(() => safeDiagramSource('a'.repeat(60001)));
});
