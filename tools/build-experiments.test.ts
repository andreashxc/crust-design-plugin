import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authorFromPath,
  buildExperiments,
  formatErrors,
  scanAndValidate,
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

  it('emits exactly the 9 RegistryEntry fields including folder', async () => {
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
      'folder',
      'id',
      'name',
      'scope',
      'tweaks',
      'world',
    ]);
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
