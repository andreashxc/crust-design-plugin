import { execFileSync } from 'node:child_process';

const allowedPrefixes = ['experiments/examples/', 'experiments/.gitkeep'];

function stagedFiles(): string[] {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBlockedExperimentPath(path: string): boolean {
  if (!path.startsWith('experiments/')) return false;
  return !allowedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

const blocked = stagedFiles().filter(isBlockedExperimentPath);

if (blocked.length > 0) {
  console.error('Refusing to commit private/client experiment files:');
  for (const path of blocked) console.error(`- ${path}`);
  console.error('');
  console.error(
    'Keep personal experiments local. Public examples must live under experiments/examples/.',
  );
  console.error(
    'If this is intentional, review the files and force-add/commit outside the default hook.',
  );
  process.exit(1);
}
