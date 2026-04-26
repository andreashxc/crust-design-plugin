import type { RegistryEntry } from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import { computeStatus } from './status';

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
    author: 'andrew',
    folder: 'smoke',
    name: 'fixture',
    description: 'd',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    chunkPath: '',
    tweaks: [],
    ...overrides,
  };
}

describe('computeStatus (D-08 / D-10)', () => {
  it("returns 'auto-disabled' when ctx.autodisabled is present", () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: true,
        autodisabled: { reason: 'r', count: 3, firstAt: 0, lastAt: 1 },
        appliedInActiveTab: [],
        activeTabUrl: 'https://ya.ru/',
      }),
    ).toBe('auto-disabled');
  });

  it("returns 'disabled' when !enabled", () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: false,
        appliedInActiveTab: [],
        activeTabUrl: 'https://ya.ru/',
      }),
    ).toBe('disabled');
  });

  it("returns 'pending' when enabled but scope does not match", () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: true,
        appliedInActiveTab: [],
        activeTabUrl: 'https://example.com/',
      }),
    ).toBe('pending');
  });

  it("returns 'pending' when activeTabUrl is missing", () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: true,
        appliedInActiveTab: [],
      }),
    ).toBe('pending');
  });

  it("returns 'applied' when scope matches and id is applied in active tab", () => {
    const entry = makeEntry();
    expect(
      computeStatus(entry, {
        enabled: true,
        appliedInActiveTab: [entry.id],
        activeTabUrl: 'https://ya.ru/',
      }),
    ).toBe('applied');
  });

  it("returns 'error' when scope matches but id is not applied in active tab", () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: true,
        appliedInActiveTab: [],
        activeTabUrl: 'https://ya.ru/',
      }),
    ).toBe('error');
  });

  it('auto-disabled wins over disabled', () => {
    expect(
      computeStatus(makeEntry(), {
        enabled: false,
        autodisabled: { reason: 'r', count: 3, firstAt: 0, lastAt: 1 },
        appliedInActiveTab: [],
      }),
    ).toBe('auto-disabled');
  });
});
