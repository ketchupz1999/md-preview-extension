/** 忽略文档内的全局配置，阅读器统一控制 Mermaid 的权限和主题。 */
export function safeDiagramSource(source) {
  if (source.length > 60000) throw new Error('图表超过 60,000 字符，请缩小后重试。');
  return source.replace(/^\s*---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '').replace(/%%\{[\s\S]*?\}%%/g, '');
}
