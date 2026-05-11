import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const target = resolve(root, 'apps/extension/.output/chrome-mv3');
const linkPath = resolve(root, 'crust-extension');

if (!existsSync(target)) {
  console.error(`Extension output does not exist: ${target}`);
  console.error('Run corepack pnpm -F @platform/extension build or corepack pnpm dev first.');
  process.exit(1);
}

if (existsSync(linkPath)) {
  const stat = lstatSync(linkPath);
  if (!stat.isSymbolicLink()) {
    console.error(`Refusing to replace non-symlink path: ${linkPath}`);
    process.exit(1);
  }
  unlinkSync(linkPath);
}

const linkType = process.platform === 'win32' ? 'junction' : 'dir';
symlinkSync(target, linkPath, linkType);
console.log(`Linked ${linkPath} -> ${target}`);
