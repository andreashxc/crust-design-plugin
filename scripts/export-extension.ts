import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'apps/extension/.output/chrome-mv3');
const distDir = resolve(root, 'dist');
const unpacked = resolve(distDir, 'crust-chrome-mv3');
const zipPath = resolve(distDir, 'crust-chrome-mv3.zip');

if (!existsSync(source)) {
  console.error(`Extension output does not exist: ${source}`);
  console.error('Run corepack pnpm -F @platform/extension build first.');
  process.exit(1);
}

rmSync(unpacked, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(distDir, { recursive: true });
cpSync(source, unpacked, { recursive: true });
execFileSync('zip', ['-qr', zipPath, 'crust-chrome-mv3'], { cwd: distDir, stdio: 'inherit' });
console.log(`Exported ${unpacked}`);
console.log(`Exported ${zipPath}`);
