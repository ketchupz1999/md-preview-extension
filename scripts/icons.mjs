import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const directory = new URL('../public/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  // 小尺寸增加视觉重量；128px 商店图标保留四周 16px 透明留白。
  const svg = size <= 32 ? source.replace('viewBox="0 0 128 128"', 'viewBox="8 8 112 112"') : source;
  const result = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  await writeFile(new URL(`${size}.png`, directory), result.asPng());
}
