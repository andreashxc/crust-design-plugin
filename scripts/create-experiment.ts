import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , authorArg, folderArg, ...nameParts] = process.argv;

function usage(): never {
  console.error('Usage: corepack pnpm create-experiment <author> <folder> [Display name]');
  process.exit(1);
}

function assertSlug(label: string, value: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value)) {
    console.error(`${label} must use letters, numbers, "-" or "_" and start with a letter/number.`);
    process.exit(1);
  }
}

function titleFromFolder(folder: string): string {
  return folder
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

if (!authorArg || !folderArg) usage();
assertSlug('author', authorArg);
assertSlug('folder', folderArg);

const displayName = nameParts.length > 0 ? nameParts.join(' ') : titleFromFolder(folderArg);
const dir = resolve(process.cwd(), 'experiments', authorArg, folderArg);
const manifestPath = resolve(dir, 'manifest.json');
const experimentPath = resolve(dir, 'experiment.ts');

if (existsSync(dir)) {
  console.error(`Experiment folder already exists: ${dir}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      id: '',
      name: displayName,
      author: authorArg,
      description: `${displayName} experiment`,
      scope: {
        match: ['*://ya.ru/*', '*://*.ya.ru/*'],
      },
      world: 'isolated',
      tweaks: [],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

writeFileSync(
  experimentPath,
  `import type { ApplyFn } from '@platform/experiment-sdk';

export const apply: ApplyFn = ({ helpers }) => {
  const node = document.createElement('aside');
  node.textContent = '${displayName} is active';
  node.style.cssText = [
    'position: fixed',
    'right: 16px',
    'bottom: 16px',
    'z-index: 2147483647',
    'padding: 10px 12px',
    'border: 1px solid #2563eb',
    'border-radius: 8px',
    'background: #fff',
    'color: #111827',
    'font: 13px/1.4 system-ui, sans-serif',
  ].join(';');

  helpers.injectNode(node);

  return () => {};
};
`,
  'utf8',
);

console.log(`Created ${dir}`);
console.log('Run corepack pnpm dev or corepack pnpm build to stamp the manifest id.');
