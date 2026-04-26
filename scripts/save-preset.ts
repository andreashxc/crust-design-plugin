import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { globSync } from 'glob';
import {
  ExperimentManifest,
  TweakValueValidationError,
  validateTweakValues,
} from '../packages/experiment-sdk/src/index';

const [, , experimentArg, nameArg, valuesArg] = process.argv;

function usage(): never {
  console.error(
    "Usage: corepack pnpm save-preset <experiment-id-or-author/folder> <preset-name> '<json-values>'",
  );
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function readManifest(path: string): ExperimentManifest {
  return ExperimentManifest.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function findManifest(root: string, selector: string): string | null {
  if (/^[^/\\]+[/\\][^/\\]+$/.test(selector)) {
    const [author, folder] = selector.split(/[/\\]/);
    if (!author || !folder) return null;
    const path = resolve(root, 'experiments', author, folder, 'manifest.json');
    return existsSync(path) ? path : null;
  }

  for (const path of globSync('experiments/*/*/manifest.json', { cwd: root, absolute: true })) {
    const manifest = readManifest(path);
    if (manifest.id === selector) return path;
  }
  return null;
}

function formatValidationError(err: unknown): string {
  if (err instanceof TweakValueValidationError) {
    return err.issues
      .map((issue) => `${issue.path?.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
  }
  return err instanceof Error ? err.message : String(err);
}

if (!experimentArg || !nameArg || !valuesArg) usage();

const root = process.cwd();
const manifestPath = findManifest(root, experimentArg);
if (!manifestPath) {
  console.error(`Experiment not found: ${experimentArg}`);
  process.exit(1);
}

const presetSlug = slugify(nameArg);
if (!presetSlug) {
  console.error('Preset name must contain at least one letter or number.');
  process.exit(1);
}

let valuesJson: unknown;
try {
  valuesJson = JSON.parse(valuesArg);
} catch (err) {
  console.error(`Preset values must be valid JSON: ${String(err)}`);
  process.exit(1);
}
if (!isRecord(valuesJson)) {
  console.error('Preset values must be a JSON object.');
  process.exit(1);
}

const manifest = readManifest(manifestPath);
let values: Record<string, unknown>;
try {
  values = validateTweakValues(manifest.tweaks, valuesJson);
} catch (err) {
  console.error(formatValidationError(err));
  process.exit(1);
}

const presetDir = resolve(dirname(manifestPath), 'presets');
const presetPath = resolve(presetDir, `${presetSlug}.json`);
mkdirSync(presetDir, { recursive: true });
writeFileSync(
  presetPath,
  `${JSON.stringify(
    {
      name: nameArg.trim(),
      values,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Saved preset: ${presetPath}`);
