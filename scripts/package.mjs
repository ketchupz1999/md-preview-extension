import { mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('release', { recursive: true });
await rm(`release/md-preview-${version}.zip`, { force: true });
execFileSync('zip', ['-qr', `../release/md-preview-${version}.zip`, '.'], { cwd: 'dist' });
console.log(`release/md-preview-${version}.zip`);
