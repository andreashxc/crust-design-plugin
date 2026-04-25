import { describe, expect, it } from 'vitest';
import { byId, type Registry, type RegistryEntry } from './index';

function makeEntry(id: string, overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id,
    author: 'andrew',
    folder: 'fixture',
    name: 'fixture',
    description: 'fixture',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    chunkPath: '',
    tweaks: [],
    ...overrides,
  };
}

describe('byId (D-30)', () => {
  it('returns undefined for an empty registry', () => {
    const registry: Registry = [];
    expect(byId(registry, '01J0AAAAAAAAAAAAAAAAAAAAAA')).toBeUndefined();
  });

  it('returns the entry when the id matches', () => {
    const a = makeEntry('01J0AAAAAAAAAAAAAAAAAAAAAA');
    const b = makeEntry('01J0BBBBBBBBBBBBBBBBBBBBBB');
    const registry: Registry = [a, b];
    expect(byId(registry, '01J0BBBBBBBBBBBBBBBBBBBBBB')).toBe(b);
  });

  it('returns the first entry when multiple match (defensive — registry should be unique)', () => {
    const a = makeEntry('01J0AAAAAAAAAAAAAAAAAAAAAA', { name: 'first' });
    const aDup = makeEntry('01J0AAAAAAAAAAAAAAAAAAAAAA', { name: 'second' });
    const registry: Registry = [a, aDup];
    expect(byId(registry, '01J0AAAAAAAAAAAAAAAAAAAAAA')).toBe(a);
  });

  it('returns undefined when no entry has the id', () => {
    const a = makeEntry('01J0AAAAAAAAAAAAAAAAAAAAAA');
    const registry: Registry = [a];
    expect(byId(registry, '01J0BBBBBBBBBBBBBBBBBBBBBB')).toBeUndefined();
  });
});
