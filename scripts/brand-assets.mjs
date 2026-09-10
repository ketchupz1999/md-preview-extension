import { Resvg } from '@resvg/resvg-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const brand = new URL('../docs/brand/', import.meta.url);
const store = new URL('../docs/chrome-store/assets/', import.meta.url);
await mkdir(brand, { recursive: true }); await mkdir(store, { recursive: true });
const icon = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const mark = icon.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<title>.*?<\/title>/, '').replace(/[ \t]+$/gm, '');
const logo = (x, y, size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 128 128">${mark}</svg>`;
const svg = (width, height, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;

// 以 RGB PNG 导出不透明宣传图，符合商店的图片格式要求。
function rgbPNG(image) {
  const { width, height, pixels } = image;
  const scanlines = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const input = (y * width + x) * 4, output = y * (width * 3 + 1) + 1 + x * 3;
    scanlines[output] = pixels[input]; scanlines[output + 1] = pixels[input + 1]; scanlines[output + 2] = pixels[input + 2];
  }
  function chunk(type, data) {
    const typeBytes = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([typeBytes, data])) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, typeBytes, data, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

const paper = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">
<rect x="12" y="-10" width="178" height="194" rx="13" fill="#9baeea" opacity=".4"/>
<rect width="178" height="194" rx="13" fill="#fff"/>
<path d="M24 30h78M24 45h124M24 56h99" stroke="#d9dfef" stroke-width="5" stroke-linecap="round"/>
<rect x="24" y="80" width="48" height="30" rx="6" fill="#e9edf9" stroke="#8b9ddb"/>
<rect x="109" y="80" width="45" height="30" rx="6" fill="#e9edf9" stroke="#8b9ddb"/>
<path d="M73 95h30m-6-4 6 4-6 4" fill="none" stroke="#6c80c4" stroke-width="2"/>
<path d="M24 136h124M24 148h102M24 160h112" stroke="#d9dfef" stroke-width="4" stroke-linecap="round"/>
</g>`;
const banner = svg(1200, 400, `<rect width="1200" height="400" fill="#f3f5fb"/>
<path d="M0 399h1200" stroke="#dfe4f1"/>
${logo(44, 90, 180)}
<text x="252" y="171" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="58" font-weight="700" fill="#25324f">MD Preview</text>
<text x="256" y="224" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="23" fill="#6b7894">Local Markdown, ready to read.</text>
<text x="256" y="270" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="14" letter-spacing="1.4" fill="#596dc0">OUTLINE · FILES · MERMAID</text>
${paper(895, 92, 1.12)}`);
const small = svg(440, 280, `<rect width="440" height="280" fill="#485da8"/>
<circle cx="74" cy="109" r="138" fill="#556cbc"/>
${logo(5, 46, 178)}${paper(220, 32, 1.02)}
<text x="29" y="250" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="24" font-weight="600" fill="#fff">MD Preview</text>`);
const marquee = svg(1400, 560, `<rect width="1400" height="560" fill="#485da8"/>
<circle cx="152" cy="280" r="380" fill="#5269b8"/>
${logo(62, 120, 290)}
<text x="399" y="246" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="69" font-weight="700" fill="#fff">MD Preview</text>
<text x="405" y="304" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="26" fill="#d6def8">Preview Markdown. Keep it local.</text>
<text x="406" y="366" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="17" letter-spacing="1.8" fill="#c4d0f4">OUTLINE · FILE EXPLORER · MERMAID</text>
${paper(1080, 133, 1.5)}`);
for (const [directory, name, source] of [[brand, 'banner', banner], [store, 'promo-small-440x280', small], [store, 'promo-marquee-1400x560', marquee]]) {
  await writeFile(new URL(`${name}.svg`, directory), source);
  await writeFile(new URL(`${name}.png`, directory), rgbPNG(new Resvg(source, { font: { loadSystemFonts: true } }).render()));
}
await writeFile(new URL('icon-512.png', brand), new Resvg(icon, { fitTo: { mode: 'width', value: 512 } }).render().asPng());
await writeFile(new URL('icon-128.png', store), new Resvg(icon).render().asPng());
console.log('Brand assets and Chrome Web Store promotional images generated.');
