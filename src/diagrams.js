import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { safeDiagramSource } from './diagram-policy.js';

let queue = Promise.resolve();
let diagramID = 0;

function hasExternalCSS(value) {
  // 保留 Mermaid 的本地 marker / filter 引用，拒绝网络、转义和外部字体引用。
  const withoutFragments = value.replace(/url\(\s*(['"]?)#[\w-]+\1\s*\)/gi, '');
  return /@import|@font-face|url\s*\(|image-set\s*\(|\\/i.test(withoutFragments);
}

/** 将生成的 SVG 收敛成静态图形，移除跳转、外部资源和交互。 */
export function sanitizeDiagram(svg) {
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'a', 'image', 'script', 'iframe', 'use', 'animate', 'set', 'animateMotion', 'animateTransform'],
    FORBID_ATTR: ['href', 'xlink:href', 'target', 'tabindex'],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of clean.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || hasExternalCSS(attribute.value)) element.removeAttribute(attribute.name);
    }
    if (element.localName === 'style' && hasExternalCSS(element.textContent)) element.remove();
  }
  const container = document.createElement('div');
  container.append(clean);
  return container.innerHTML;
}

/** 在本地串行绘图；共享 Mermaid 实例的配置不会被并行渲染覆盖。 */
export function renderDiagrams(container, sources, dark, signal) {
  const job = async () => {
    if (signal.aborted) return;
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
      theme: dark ? 'dark' : 'default', fontFamily: 'Avenir Next, PingFang SC, Microsoft YaHei, sans-serif',
      htmlLabels: false, flowchart: { htmlLabels: false, useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true, actorMargin: 60, messageMargin: 40 },
      layout: 'dagre', maxTextSize: 60000, maxEdges: 500,
      secure: ['securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering', 'themeCSS', 'fontFamily', 'htmlLabels', 'layout'],
    });
    for (let index = 0; index < sources.length; index++) {
      if (signal.aborted) return;
      const canvas = container.querySelector(`[data-diagram-slot="${index}"]`);
      if (!canvas) continue;
      const scratch = document.createElement('div');
      scratch.className = 'mermaid-scratch';
      document.body.append(scratch);
      try {
        if (index >= 40) throw new Error('每份文档最多绘制 40 张图，其余图表可查看源码。');
        const source = safeDiagramSource(sources[index]);
        const { svg } = await mermaid.render(`local-diagram-${++diagramID}`, source, scratch);
        if (!signal.aborted) canvas.innerHTML = sanitizeDiagram(svg);
      } catch (error) {
        if (!signal.aborted) {
          const message = document.createElement('p');
          message.className = 'diagram-error';
          message.textContent = `图表未能绘制，可以展开源码检查语法。${String(error.message || error).slice(0, 240)}`;
          canvas.replaceChildren(message);
        }
      } finally { scratch.remove(); }
    }
  };
  queue = queue.then(job, job);
  return queue;
}
