import type { Registry, RegistryEntry } from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import { groupByAuthor } from './grouping';

function makeEntry(author: string, id: string, match = ['*://ya.ru/*']): RegistryEntry {
  return {
    id,
    author,
    folder: id.toLowerCase(),
    name: id,
    description: 'd',
    scope: { match },
    world: 'isolated',
    chunkPath: '',
    tweaks: [],
  };
}

const stubMatchesScope = (url: string, scope: { match: string[]; regex?: string[] }): boolean =>
  scope.match.some((pattern) => pattern.includes('ya.ru')) && url.includes('ya.ru');

describe('groupByAuthor (D-22)', () => {
  it('returns [] for an empty registry', () => {
    expect(groupByAuthor([], { matchesScope: stubMatchesScope })).toEqual([]);
  });

  it('groups entries by author sorted alphabetical case-insensitive', () => {
    const registry: Registry = [
      makeEntry('zoe', '01J0ZZZZZZZZZZZZZZZZZZZZZZ'),
      makeEntry('Andrew', '01J0AAAAAAAAAAAAAAAAAAAAAA'),
      makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAB'),
      makeEntry('Beth', '01J0BBBBBBBBBBBBBBBBBBBBBB'),
    ];

    const groups = groupByAuthor(registry, { matchesScope: stubMatchesScope });
    expect(groups.map((group) => group.author.toLowerCase())).toEqual([
      'andrew',
      'andrew',
      'beth',
      'zoe',
    ]);
  });

  it('entry count is total experiments by author', () => {
    const registry: Registry = [
      makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAA'),
      makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAB'),
      makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAC'),
      makeEntry('beth', '01J0BBBBBBBBBBBBBBBBBBBBBB'),
    ];

    const groups = groupByAuthor(registry, { matchesScope: stubMatchesScope });
    expect(groups.find((group) => group.author === 'andrew')?.entries).toHaveLength(3);
    expect(groups.find((group) => group.author === 'beth')?.entries).toHaveLength(1);
  });

  it('defaultOpen=true when at least one entry matches active tab', () => {
    const registry: Registry = [
      makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAA', ['*://ya.ru/*']),
      makeEntry('beth', '01J0BBBBBBBBBBBBBBBBBBBBBB', ['*://example.com/*']),
    ];

    const groups = groupByAuthor(registry, {
      activeTabUrl: 'https://ya.ru/path',
      matchesScope: stubMatchesScope,
    });

    expect(groups.find((group) => group.author === 'andrew')?.defaultOpen).toBe(true);
    expect(groups.find((group) => group.author === 'beth')).toBeUndefined();
  });

  it('defaultOpen=false when activeTabUrl is missing', () => {
    const groups = groupByAuthor([makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAA')], {
      matchesScope: stubMatchesScope,
    });

    expect(groups[0]?.defaultOpen).toBe(false);
  });

  it('filters entries by active tab URL when present', () => {
    const groups = groupByAuthor(
      [
        makeEntry('andrew', '01J0AAAAAAAAAAAAAAAAAAAAAA', ['*://ya.ru/*']),
        makeEntry('beth', '01J0BBBBBBBBBBBBBBBBBBBBBB', ['*://example.com/*']),
      ],
      { activeTabUrl: 'https://ya.ru/', matchesScope: stubMatchesScope },
    );

    expect(groups.map((group) => group.author)).toEqual(['andrew']);
  });
});
