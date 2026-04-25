import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authorFromPath, formatErrors, scanAndValidate } from './build-experiments';

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
