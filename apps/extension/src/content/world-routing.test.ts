import type { ExperimentManifest } from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import { filterByWorld } from './engine';

function makeManifest(overrides: Partial<ExperimentManifest> = {}): ExperimentManifest {
  return {
    id: '01J0ABCDEFGHJKMNPQRSTVWXYZ',
    name: 'test',
    author: 'andrew',
    description: 'd',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    tweaks: [],
    ...overrides,
  };
}

describe('filterByWorld (D-13 declarative routing)', () => {
  it('isolated filter includes manifests with world: "isolated"', () => {
    const m = makeManifest({ world: 'isolated' });
    expect(filterByWorld([m], 'isolated')).toEqual([m]);
  });

  it('isolated filter excludes manifests with world: "main"', () => {
    const m = makeManifest({ id: '01J0ABCDEFGHJKMNPQRSTVWXY1', world: 'main' });
    expect(filterByWorld([m], 'isolated')).toEqual([]);
  });

  it('main filter includes manifests with world: "main"', () => {
    const m = makeManifest({ id: '01J0ABCDEFGHJKMNPQRSTVWXY2', world: 'main' });
    expect(filterByWorld([m], 'main')).toEqual([m]);
  });

  it('main filter excludes manifests with world: "isolated"', () => {
    const m = makeManifest({ world: 'isolated' });
    expect(filterByWorld([m], 'main')).toEqual([]);
  });

  it('a mixed list partitions correctly', () => {
    const i1 = makeManifest({ id: '01J0AAAAAAAAAAAAAAAAAAAAAA', world: 'isolated' });
    const m1 = makeManifest({ id: '01J0BBBBBBBBBBBBBBBBBBBBBB', world: 'main' });
    const i2 = makeManifest({ id: '01J0CCCCCCCCCCCCCCCCCCCCCC', world: 'isolated' });
    expect(filterByWorld([i1, m1, i2], 'isolated')).toEqual([i1, i2]);
    expect(filterByWorld([i1, m1, i2], 'main')).toEqual([m1]);
  });

  it('empty list returns empty', () => {
    expect(filterByWorld([], 'isolated')).toEqual([]);
    expect(filterByWorld([], 'main')).toEqual([]);
  });
});
