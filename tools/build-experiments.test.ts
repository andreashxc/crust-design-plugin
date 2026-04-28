import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authorFromPath,
  buildExperiments,
  formatErrors,
  isExperimentPath,
  scanAndValidate,
  writeDevExperimentArtifacts,
} from './build-experiments';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo root is the parent of tools/.
const REPO_ROOT = resolve(__dirname, '..');
const FIXTURES_DIR = resolve(REPO_ROOT, 'tests/fixtures/manifests');

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = resolve(
    tmpdir(),
    `build-experiments-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpRoot, { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeManifest(rel: string, value: unknown): string {
  const abs = resolve(tmpRoot, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return abs;
}

function writeFixture(rel: string, fixtureName: string): string {
  const fixturePath = resolve(FIXTURES_DIR, fixtureName);
  const raw = readFileSync(fixturePath, 'utf8');
  const abs = resolve(tmpRoot, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, raw, 'utf8');
  return abs;
}

function writeExperiment(
  rel = 'experiments/andrew/smoke/experiment.ts',
  source = 'export const apply = () => () => {};\n',
): string {
  const abs = resolve(tmpRoot, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, source, 'utf8');
  return abs;
}

function writeDescription(rel: string, markdown: string): string {
  const abs = resolve(tmpRoot, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, markdown, 'utf8');
  return abs;
}

async function invokeGenerateBundle(
  plugin: Plugin,
  bundle: Record<string, { type: 'chunk' | 'asset'; facadeModuleId?: string | null }>,
): Promise<{ emitted: Array<{ fileName?: string; source?: string }> }> {
  const emitted: Array<{ fileName?: string; source?: string }> = [];
  const ctx = {
    emitFile(file: { fileName?: string; source?: string }) {
      emitted.push(file);
      return 'asset-ref';
    },
  };
  const hook = (
    plugin as unknown as {
      generateBundle: (
        this: typeof ctx,
        options: Record<string, never>,
        bundle: Record<string, { type: 'chunk' | 'asset'; facadeModuleId?: string | null }>,
      ) => void | Promise<void>;
    }
  ).generateBundle;
  await hook.call(ctx, {}, bundle);
  return { emitted };
}

describe('authorFromPath', () => {
  it('extracts author segment from valid path', () => {
    expect(authorFromPath('experiments/andrew/smoke/manifest.json')).toBe('andrew');
  });
  it('returns unknown for invalid depth', () => {
    expect(authorFromPath('experiments/andrew/manifest.json')).toBe('<unknown>');
  });
  it('returns unknown for non-experiments root', () => {
    expect(authorFromPath('foo/andrew/smoke/manifest.json')).toBe('<unknown>');
  });
});

describe('scanAndValidate — discovery (BLD-01)', () => {
  it('discovers manifests at exactly experiments/*/*/manifest.json', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0ABCDEFGHJKMNPQRSTVWXYZ',
      name: 'a',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeManifest('experiments/andrew/another/manifest.json', {
      id: '01J0BBBBBBBBBBBBBBBBBBBBBB',
      name: 'b',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    // This one is at wrong depth and must NOT be discovered.
    writeManifest('experiments/andrew/manifest.json', {
      id: 'ignored',
      name: 'x',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toEqual([]);
    expect(result.manifests).toHaveLength(2);
  });

  it('returns empty when no manifests exist', () => {
    const result = scanAndValidate(tmpRoot);
    expect(result.manifests).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});

describe('dev experiment artifacts', () => {
  it('identifies paths under experiments/', () => {
    expect(
      isExperimentPath(tmpRoot, resolve(tmpRoot, 'experiments/andrew/foo/manifest.json')),
    ).toBe(true);
    expect(isExperimentPath(tmpRoot, resolve(tmpRoot, 'apps/extension/src/App.tsx'))).toBe(false);
  });

  it('writes registry.json and experiment chunks for dev refresh', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeFileSync(
      resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts'),
      "export const apply = () => () => { document.body.dataset.smoke = 'clean'; };\n",
      'utf8',
    );

    const outDir = resolve(tmpRoot, 'apps/extension/.output/chrome-mv3');
    const result = writeDevExperimentArtifacts({ root: tmpRoot, outDir });

    expect(result.registry).toHaveLength(1);
    expect(result.registry[0]?.sourceDir).toBe(resolve(tmpRoot, 'experiments/andrew/smoke'));
    expect(result.registry[0]?.sourceSignature).toMatch(/^[a-f0-9]{16}$/);
    expect(existsSync(resolve(outDir, 'registry.json'))).toBe(true);
    expect(existsSync(resolve(outDir, result.registry[0]?.chunkPath ?? ''))).toBe(true);
  });

  it('removes stale dev experiment chunks before writing fresh output', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeFileSync(
      resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts'),
      'export const apply = () => () => {};\n',
      'utf8',
    );
    const outDir = resolve(tmpRoot, 'apps/extension/.output/chrome-mv3');
    const staleChunk = resolve(outDir, 'chunks/experiments-andrew__old-deadbeef.js');
    mkdirSync(resolve(staleChunk, '..'), { recursive: true });
    writeFileSync(staleChunk, 'stale', 'utf8');

    writeDevExperimentArtifacts({ root: tmpRoot, outDir });

    expect(existsSync(staleChunk)).toBe(false);
  });
});

describe('scanAndValidate — ULID write-back (D-17)', () => {
  it('writes a ULID when id is empty', () => {
    const path = writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '',
      name: 'a',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toEqual([]);
    const written = JSON.parse(readFileSync(path, 'utf8')) as { id: string };
    expect(written.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(result.warnings.some((w) => w.includes('Wrote new id'))).toBe(true);
  });

  it('is idempotent — second scan does not rewrite an already-stamped id', () => {
    const path = writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '',
      name: 'a',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    scanAndValidate(tmpRoot);
    const after1 = readFileSync(path, 'utf8');
    const result2 = scanAndValidate(tmpRoot);
    const after2 = readFileSync(path, 'utf8');
    expect(after1).toBe(after2);
    expect(result2.warnings).toEqual([]);
  });
});

describe('scanAndValidate — Zod errors (BLD-02)', () => {
  it('reports an error for invalid world', () => {
    writeFixture('experiments/andrew/smoke/manifest.json', 'bad-world.json');
    // bad-world.json has author === 'andrew' so the folder check passes; only world is wrong.
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe('schema');
    expect(result.errors[0]?.issues.some((i) => i.path === 'world')).toBe(true);
  });

  it('reports an error for empty scope.match', () => {
    writeFixture('experiments/andrew/smoke/manifest.json', 'empty-match.json');
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.issues.some((i) => i.path === 'scope.match')).toBe(true);
  });

  it('formatErrors produces a multi-line readable output', () => {
    writeFixture('experiments/andrew/smoke/manifest.json', 'bad-world.json');
    const result = scanAndValidate(tmpRoot);
    const formatted = formatErrors(result.errors);
    expect(formatted).toMatch(/Manifest validation failed:/);
    expect(formatted).toMatch(/experiments\/andrew\/smoke\/manifest\.json/);
    expect(formatted).toMatch(/world:/);
  });
});

describe('scanAndValidate — author-vs-folder (D-18)', () => {
  it('throws when manifest.author does not match the folder name', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0ABCDEFGHJKMNPQRSTVWXYZ',
      name: 'a',
      author: 'bob', // author bob, folder andrew
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe('author-mismatch');
    expect(result.errors[0]?.issues[0]?.message).toMatch(/bob/);
    expect(result.errors[0]?.issues[0]?.message).toMatch(/andrew/);
  });

  it('passes when manifest.author matches the folder name', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0ABCDEFGHJKMNPQRSTVWXYZ',
      name: 'a',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toEqual([]);
    expect(result.manifests).toHaveLength(1);
  });
});

describe('scanAndValidate — tweak key validation (TWK-01)', () => {
  it('reports duplicate tweak keys before registry emission', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0ABCDEFGHJKMNPQRSTVWXYZ',
      name: 'a',
      author: 'andrew',
      description: 'd',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [
        { type: 'toggle', key: 'enabled', label: 'Enabled', default: true },
        { type: 'text', key: 'enabled', label: 'Copy', default: 'hello' },
      ],
    });

    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe('duplicate-tweak-key');
    expect(result.errors[0]?.issues[0]?.message).toContain('enabled');
  });
});

describe('scanAndValidate — Phase 5 metadata', () => {
  it('discovers and validates preset files', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Default' }],
    });
    writeExperiment();
    writeManifest('experiments/andrew/smoke/presets/default.json', {
      name: 'Default preset',
      values: { headline: 'Hello' },
    });

    const result = scanAndValidate(tmpRoot);

    expect(result.errors).toEqual([]);
    expect(result.manifests[0]?.meta.presets).toEqual([
      {
        name: 'Default preset',
        path: 'experiments/andrew/smoke/presets/default.json',
        values: { headline: 'Hello' },
      },
    ]);
  });

  it('reports invalid preset values with the preset file path', () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [{ type: 'color', key: 'accent', label: 'Accent', default: '#ff3366' }],
    });
    writeExperiment();
    writeManifest('experiments/andrew/smoke/presets/default.json', {
      values: { accent: 'pink' },
    });

    const result = scanAndValidate(tmpRoot);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe('preset');
    expect(result.errors[0]?.file).toBe('experiments/andrew/smoke/presets/default.json');
    expect(formatErrors(result.errors)).toContain('presets/default.json');
  });

  it('computes missing, fresh, stale, and manual description status', () => {
    const manifestPath = writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    const experimentPath = writeExperiment();

    expect(scanAndValidate(tmpRoot).manifests[0]?.meta.descriptionStatus).toBe('missing');

    const descriptionPath = writeDescription(
      'experiments/andrew/smoke/description.md',
      '---\ngenerated: true\n---\n# Smoke\n',
    );
    const oldTime = new Date(1000);
    const newTime = new Date(5000);
    utimesSync(descriptionPath, newTime, newTime);
    utimesSync(manifestPath, oldTime, oldTime);
    utimesSync(experimentPath, oldTime, oldTime);
    expect(scanAndValidate(tmpRoot).manifests[0]?.meta.descriptionStatus).toBe('fresh');

    utimesSync(descriptionPath, oldTime, oldTime);
    utimesSync(experimentPath, newTime, newTime);
    expect(scanAndValidate(tmpRoot).manifests[0]?.meta.descriptionStatus).toBe('stale');

    writeDescription(
      'experiments/andrew/smoke/description.md',
      '---\ngenerated: false\n---\n# Smoke\n',
    );
    expect(scanAndValidate(tmpRoot).manifests[0]?.meta.descriptionStatus).toBe('manual');
  });
});

describe('scanAndValidate — Phase 6 acceptance fixtures', () => {
  it('includes three designer fixture authors with required helper coverage', () => {
    writeManifest('experiments/designer1/acceptance-banner/manifest.json', {
      id: '01KQEX1N4P0MB85K9G2M7H9AF1',
      name: 'Acceptance banner',
      author: 'designer1',
      description: 'Fixture with 3+ tweak types',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [
        { type: 'toggle', key: 'enabled', label: 'Enabled', default: true },
        {
          type: 'select',
          key: 'tone',
          label: 'Tone',
          default: 'calm',
          options: ['calm'],
        },
        { type: 'text', key: 'headline', label: 'Headline', default: 'Hello' },
      ],
    });
    writeExperiment('experiments/designer1/acceptance-banner/experiment.ts');
    writeManifest('experiments/designer2/page-summary/manifest.json', {
      id: '01KQEX1N4P0MB85K9G2M7H9AF2',
      name: 'Page summary',
      author: 'designer2',
      description: 'Fixture using fetchPage',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeExperiment(
      'experiments/designer2/page-summary/experiment.ts',
      'export const apply = async ({ helpers }) => { await helpers.fetchPage("https://ya.ru/", "body"); return () => {}; };\n',
    );
    writeManifest('experiments/designer3/ai-label/manifest.json', {
      id: '01KQEX1N4P0MB85K9G2M7H9AF3',
      name: 'AI label',
      author: 'designer3',
      description: 'Fixture using llm',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeExperiment(
      'experiments/designer3/ai-label/experiment.ts',
      'export const apply = async ({ helpers }) => { await helpers.llm("label"); return () => {}; };\n',
    );

    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toEqual([]);

    const fixtureAuthors = new Set(['designer1', 'designer2', 'designer3']);
    const fixtures = result.manifests.filter(({ data }) => fixtureAuthors.has(data.author));

    expect(new Set(fixtures.map(({ data }) => data.author))).toEqual(fixtureAuthors);
    expect(
      fixtures.every(({ data }) => data.scope.match.some((match) => match.includes('ya.ru'))),
    ).toBe(true);
    expect(fixtures.some(({ data }) => data.tweaks.length >= 3)).toBe(true);

    const fixtureSource = fixtures
      .map(({ path }) => readFileSync(resolve(tmpRoot, dirname(path), 'experiment.ts'), 'utf8'))
      .join('\n');
    expect(fixtureSource).toContain('helpers.fetchPage');
    expect(fixtureSource).toContain('helpers.llm');
  });
});

describe('scanAndValidate — JSON parse failure', () => {
  it('reports a parse error for malformed JSON', () => {
    const abs = resolve(tmpRoot, 'experiments/andrew/smoke/manifest.json');
    mkdirSync(resolve(abs, '..'), { recursive: true });
    writeFileSync(abs, '{ not json', 'utf8');
    const result = scanAndValidate(tmpRoot);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.kind).toBe('parse');
  });
});

describe('build-experiments generateBundle hook (BLD-03 / BLD-04)', () => {
  it('emits registry.json with one entry per scanned manifest', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc-a',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    writeManifest('experiments/designer1/foo/manifest.json', {
      id: '01J0BBBBBBBBBBBBBBBBBBBBBB',
      name: 'Foo',
      author: 'designer1',
      description: 'desc-b',
      scope: { match: ['*://example.com/*'] },
      world: 'main',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {
      'chunks/experiments-andrew__smoke-AAA.js': {
        type: 'chunk',
        facadeModuleId: resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts'),
      },
      'chunks/experiments-designer1__foo-BBB.js': {
        type: 'chunk',
        facadeModuleId: resolve(tmpRoot, 'experiments/designer1/foo/experiment.ts'),
      },
    });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe('registry.json');
    const registry = JSON.parse(emitted[0]?.source ?? 'null');
    expect(registry).toHaveLength(2);
  });

  it('emits RegistryEntry fields including Phase 5 metadata', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {
      'chunks/experiments-andrew__smoke-AAA.js': {
        type: 'chunk',
        facadeModuleId: resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts'),
      },
    });

    const registry = JSON.parse(emitted[0]?.source ?? '[]');
    expect(Object.keys(registry[0]).sort()).toEqual([
      'author',
      'chunkPath',
      'description',
      'descriptionStatus',
      'folder',
      'id',
      'name',
      'presets',
      'scope',
      'sourceSignature',
      'tweaks',
      'world',
    ]);
    expect(registry[0]?.sourceDir).toBeUndefined();
  });

  it('maps folder from the experiment directory name', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {});
    const registry = JSON.parse(emitted[0]?.source ?? '[]');
    expect(registry[0]?.folder).toBe('smoke');
  });

  it('maps chunkPath from Rollup facadeModuleId to emitted chunk filename', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {
      'chunks/experiments-andrew__smoke-D7gqXz.js': {
        type: 'chunk',
        facadeModuleId: resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts'),
      },
    });
    const registry = JSON.parse(emitted[0]?.source ?? '[]');
    expect(registry[0]?.chunkPath).toBe('chunks/experiments-andrew__smoke-D7gqXz.js');
  });

  it('uses an empty chunkPath sentinel when no matching chunk is found', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {});
    const registry = JSON.parse(emitted[0]?.source ?? '[]');
    expect(registry[0]?.chunkPath).toBe('');
  });

  it('emits a browser ESM experiment chunk when Rollup does not expose one', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });
    const experimentPath = resolve(tmpRoot, 'experiments/andrew/smoke/experiment.ts');
    writeFileSync(
      experimentPath,
      "export const apply = () => () => { document.body.dataset.smoke = 'clean'; };\n",
      'utf8',
    );

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {});
    const registryAsset = emitted.find((asset) => asset.fileName === 'registry.json');
    const registry = JSON.parse(registryAsset?.source ?? '[]');

    expect(registry[0]?.chunkPath).toMatch(/^chunks\/experiments-andrew__smoke-[a-f0-9]+\.js$/);
    const chunkAsset = emitted.find((asset) => asset.fileName === registry[0]?.chunkPath);
    expect(chunkAsset?.source).toContain('export');
    expect(chunkAsset?.source).toContain('document.body.dataset.smoke');
  });

  it('emits idempotent pretty JSON with one trailing newline', async () => {
    writeManifest('experiments/andrew/smoke/manifest.json', {
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      name: 'Smoke',
      author: 'andrew',
      description: 'desc',
      scope: { match: ['*://ya.ru/*'] },
      world: 'isolated',
      tweaks: [],
    });

    const plugin = buildExperiments({ root: tmpRoot });
    (plugin as unknown as { buildStart: () => void }).buildStart();

    const { emitted } = await invokeGenerateBundle(plugin, {});
    const source = emitted[0]?.source ?? '';
    expect(source.endsWith('\n')).toBe(true);
    expect(source.endsWith('\n\n')).toBe(false);
    expect(() => JSON.parse(source)).not.toThrow();
  });
});
