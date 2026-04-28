import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { globSync } from 'glob';
import { designContextHint } from './design-context';

const [, , sourceArg, targetAuthorArg, targetFolderArg] = process.argv;

function usage(): never {
  console.error(
    'Usage: corepack pnpm fork-experiment <source-id-or-author/folder> <target-author> [target-folder]',
  );
  process.exit(1);
}

function assertSlug(label: string, value: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value)) {
    console.error(`${label} must use letters, numbers, "-" or "_" and start with a letter/number.`);
    process.exit(1);
  }
}

function readJson(path: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function findManifest(root: string, selector: string): string | null {
  if (/^[^/\\]+[/\\][^/\\]+$/.test(selector)) {
    const [author, folder] = selector.split(/[/\\]/);
    if (!author || !folder) return null;
    const path = resolve(root, 'experiments', author, folder, 'manifest.json');
    return existsSync(path) ? path : null;
  }

  for (const path of globSync('experiments/*/*/manifest.json', { cwd: root, absolute: true })) {
    const manifest = readJson(path);
    if (manifest.id === selector) return path;
  }

  return null;
}

function copyIfExists(source: string, target: string): void {
  if (!existsSync(source)) return;
  cpSync(source, target, { recursive: true });
}

function firstScopeMatch(manifest: Record<string, unknown>): string | null {
  const scope = manifest.scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  const match = (scope as Record<string, unknown>).match;
  if (!Array.isArray(match)) return null;
  return match.find((value): value is string => typeof value === 'string') ?? null;
}

function requireSourcePath(path: string, label: string): void {
  if (existsSync(path)) return;
  console.error(`Source experiment is missing ${label}: ${path}`);
  process.exit(1);
}

if (!sourceArg || !targetAuthorArg) usage();
assertSlug('target author', targetAuthorArg);

const root = process.cwd();
const sourceManifestPath = findManifest(root, sourceArg);
if (!sourceManifestPath) {
  console.error(`Experiment not found: ${sourceArg}`);
  process.exit(1);
}

const sourceDir = dirname(sourceManifestPath);
const sourceFolder = basename(sourceDir);
const targetFolder = targetFolderArg ?? sourceFolder;
assertSlug('target folder', targetFolder);

const targetDir = resolve(root, 'experiments', targetAuthorArg, targetFolder);
if (existsSync(targetDir)) {
  console.error(`Target experiment folder already exists: ${targetDir}`);
  process.exit(1);
}

const sourceExperimentPath = resolve(sourceDir, 'experiment.ts');
const sourceDescriptionPath = resolve(sourceDir, 'description.md');
const sourcePresetsDir = resolve(sourceDir, 'presets');
requireSourcePath(sourceExperimentPath, 'experiment.ts');
requireSourcePath(sourceDescriptionPath, 'description.md');

mkdirSync(targetDir, { recursive: true });
cpSync(sourceExperimentPath, resolve(targetDir, 'experiment.ts'));
cpSync(sourceDescriptionPath, resolve(targetDir, 'description.md'));
copyIfExists(sourcePresetsDir, resolve(targetDir, 'presets'));
mkdirSync(resolve(targetDir, 'presets'), { recursive: true });

const manifest = readJson(sourceManifestPath);
manifest.id = '';
manifest.author = targetAuthorArg;
writeFileSync(
  resolve(targetDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Forked ${sourceArg} to ${targetAuthorArg}/${targetFolder}`);
const contextHint = designContextHint(
  root,
  firstScopeMatch(manifest) ?? `${targetAuthorArg}/${targetFolder}`,
);
if (contextHint) {
  console.log('');
  console.log(contextHint);
}
console.log('Run corepack pnpm dev or corepack pnpm build to stamp the new manifest id.');
