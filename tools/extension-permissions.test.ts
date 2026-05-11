import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  experimentMatchesForExtension,
  FALLBACK_EXTENSION_MATCHES,
  hostPermissionForMatch,
} from './extension-permissions';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = resolve(
    tmpdir(),
    `extension-permissions-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpRoot, { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeManifest(rel: string, value: unknown): void {
  const path = resolve(tmpRoot, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('hostPermissionForMatch', () => {
  it('normalizes path match patterns to origin-level host permissions', () => {
    expect(hostPermissionForMatch('https://example.com/pricing*')).toBe('https://example.com/*');
    expect(hostPermissionForMatch('https://*.example.com/foo*')).toBe('https://*.example.com/*');
  });

  it('returns null for unsupported patterns', () => {
    expect(hostPermissionForMatch('not-a-pattern')).toBeNull();
  });
});

describe('experimentMatchesForExtension', () => {
  it('uses exact content matches and origin-level web accessible matches', () => {
    writeManifest('experiments/andrew/pricing/manifest.json', {
      scope: { match: ['https://example.com/pricing*'] },
    });

    const result = experimentMatchesForExtension(tmpRoot);

    expect(result.contentMatches).toEqual(['https://example.com/pricing*']);
    expect(result.webAccessibleMatches).toEqual(['https://example.com/*']);
    expect(result.hostPermissions).toEqual(['https://example.com/*']);
  });

  it('falls back to public example matches when no experiment manifests exist', () => {
    const result = experimentMatchesForExtension(tmpRoot);
    expect(result.contentMatches).toEqual(FALLBACK_EXTENSION_MATCHES);
    expect(result.webAccessibleMatches).toEqual(['*://*.ya.ru/*', '*://ya.ru/*']);
    expect(result.hostPermissions).toEqual(['*://*.ya.ru/*', '*://ya.ru/*']);
  });

  it('fails clearly on malformed manifests', () => {
    const path = resolve(tmpRoot, 'experiments/andrew/bad/manifest.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '{ not json', 'utf8');

    expect(() => experimentMatchesForExtension(tmpRoot)).toThrow(
      /Failed to parse experiments\/andrew\/bad\/manifest\.json/,
    );
  });
});
