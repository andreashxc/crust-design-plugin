import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import { ExperimentManifest, type TweakDefinition } from '../packages/experiment-sdk/src/index';

type Result = {
  generated: string[];
  skippedManual: string[];
};

function hasGeneratedFalse(markdown: string): boolean {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  return Boolean(match?.[1]?.split('\n').some((line) => /^generated:\s*false\s*$/i.test(line)));
}

function shouldWriteDescription(path: string): boolean {
  if (!existsSync(path)) return true;
  return !hasGeneratedFalse(readFileSync(path, 'utf8'));
}

function helperUsage(experimentPath: string): string[] {
  if (!existsSync(experimentPath)) return [];
  const source = readFileSync(experimentPath, 'utf8');
  return Array.from(source.matchAll(/\bhelpers\.([a-zA-Z_$][\w$]*)/g))
    .map((match) => match[1])
    .filter((name): name is string => Boolean(name))
    .filter((name, index, values) => values.indexOf(name) === index)
    .sort();
}

function tweakType(tweak: TweakDefinition): string {
  return tweak.type;
}

function tweakDefault(tweak: TweakDefinition): string {
  return JSON.stringify(tweak.default);
}

function buildTweakTable(tweaks: TweakDefinition[]): string {
  if (tweaks.length === 0) return 'No tweaks yet.\n';

  const lines = ['| Key | Label | Type | Default |', '| --- | --- | --- | --- |'];
  for (const tweak of tweaks) {
    lines.push(
      `| \`${tweak.key}\` | ${tweak.label} | ${tweakType(tweak)} | \`${tweakDefault(tweak)}\` |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function maxSourceMtime(paths: string[]): Date {
  const time = Math.max(...paths.filter(existsSync).map((path) => statSync(path).mtimeMs));
  return new Date(time);
}

function descriptionMarkdown(args: {
  manifest: ExperimentManifest;
  manifestPath: string;
  experimentPath: string;
}): string {
  const helpers = helperUsage(args.experimentPath);
  const generatedAt = maxSourceMtime([args.manifestPath, args.experimentPath]).toISOString();
  const scope = [
    ...args.manifest.scope.match.map((pattern) => `- \`${pattern}\``),
    ...(args.manifest.scope.regex ?? []).map((pattern) => `- regex \`${pattern}\``),
  ].join('\n');

  return `---
generated: true
generatedAt: ${generatedAt}
---

# ${args.manifest.name}

${args.manifest.description}

## Metadata

- Author: \`${args.manifest.author}\`
- World: \`${args.manifest.world}\`

## Scope

${scope}

## Tweaks

${buildTweakTable(args.manifest.tweaks)}
## Helper Usage

${helpers.length > 0 ? helpers.map((helper) => `- \`${helper}\``).join('\n') : 'No helpers detected.'}
`;
}

export function generateDescriptions(root = process.cwd()): Result {
  const result: Result = { generated: [], skippedManual: [] };
  const manifests = globSync('experiments/*/*/manifest.json', { cwd: root, absolute: true }).sort();

  for (const manifestPath of manifests) {
    const experimentDir = dirname(manifestPath);
    const descriptionPath = resolve(experimentDir, 'description.md');
    if (!shouldWriteDescription(descriptionPath)) {
      result.skippedManual.push(relative(root, descriptionPath));
      continue;
    }

    const manifest = ExperimentManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
    const experimentPath = resolve(experimentDir, 'experiment.ts');
    const markdown = descriptionMarkdown({ manifest, manifestPath, experimentPath });
    const current = existsSync(descriptionPath) ? readFileSync(descriptionPath, 'utf8') : null;
    if (current !== markdown) {
      mkdirSync(experimentDir, { recursive: true });
      writeFileSync(descriptionPath, markdown, 'utf8');
      result.generated.push(relative(root, descriptionPath));
    }
  }

  return result;
}

const calledAsScript = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (calledAsScript) {
  const result = generateDescriptions();
  for (const file of result.generated) console.log(`Generated ${file}`);
  for (const file of result.skippedManual) console.log(`Skipped manual ${file}`);
  if (result.generated.length === 0 && result.skippedManual.length === 0) {
    console.log('No experiment descriptions found.');
  }
}
