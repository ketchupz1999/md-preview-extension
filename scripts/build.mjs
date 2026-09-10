import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './icons.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await rm('dist', { recursive: true, force: true });
await mkdir('dist/icons', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({
  entryPoints: { reader: 'src/app.jsx', background: 'src/background.js' },
  bundle: true, splitting: true, chunkNames: 'chunks/[name]-[hash]', outdir: 'dist', format: 'esm', target: 'chrome121', minify: true,
  jsx: 'automatic', jsxImportSource: 'preact', legalComments: 'eof',
});
await build({ entryPoints: ['src/content.js'], outfile: 'dist/content.js', bundle: true, format: 'iife', target: 'chrome121', minify: true });
await cp('src/style.css', 'dist/reader.css');
await cp('LICENSE', 'dist/LICENSE');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const thirdParty = [];
for (const [directory, metadata] of Object.entries(lock.packages)) {
  if (!directory || metadata.dev) continue;
  const names = await readdir(directory);
  const licenseFiles = names.filter((name) => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name));
  thirdParty.push(`\n--- ${directory.replace(/^node_modules\//, '')} @ ${metadata.version} (${metadata.license || 'see license'}) ---\n`);
  for (const name of licenseFiles) thirdParty.push(await readFile(`${directory}/${name}`, 'utf8'));
}
await writeFile('dist/THIRD_PARTY_LICENSES.txt', thirdParty.join('\n'));

console.log('Built dist/ — load this folder as an unpacked extension.');
