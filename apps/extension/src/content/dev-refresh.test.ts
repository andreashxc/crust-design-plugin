import type { RegistryEntry } from '@platform/experiment-sdk';
import { describe, expect, it, vi } from 'vitest';
import { createRegistryApplySignature, startDevRegistryRefresh } from './dev-refresh';

function entry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
    author: 'andrew',
    folder: 'smoke',
    name: 'Smoke',
    description: 'desc',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    chunkPath: 'chunks/smoke-a.js',
    tweaks: [],
    ...overrides,
  };
}

describe('dev registry refresh', () => {
  it('builds a signature from enabled scope-matching entries', () => {
    expect(
      createRegistryApplySignature(
        [
          entry({ id: 'A', chunkPath: 'a.js', sourceSignature: 'one' }),
          entry({ id: 'B', chunkPath: 'b.js', sourceSignature: 'two' }),
        ],
        { A: true, B: false },
        'https://ya.ru/',
      ),
    ).toBe('A:a.js:one');
  });

  it('does not start polling when disabled', () => {
    const setInterval = vi.fn() as unknown as typeof globalThis.setInterval;

    const stop = startDevRegistryRefresh({
      enabled: false,
      loadEntries: async () => [],
      getEnabledExperiments: async () => ({}),
      getCurrentUrl: () => 'https://ya.ru/',
      schedule: vi.fn(),
      setInterval,
    });

    stop();
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('schedules reconcile when an enabled matching chunk signature changes', async () => {
    let intervalCallback: (() => void) | undefined;
    let entries = [entry({ chunkPath: 'chunks/smoke-a.js', sourceSignature: 'one' })];
    const schedule = vi.fn();
    const loadEntries = vi.fn(async () => entries);

    startDevRegistryRefresh({
      enabled: true,
      loadEntries,
      getEnabledExperiments: async () => ({ '01J0AAAAAAAAAAAAAAAAAAAAAA': true }),
      getCurrentUrl: () => 'https://ya.ru/',
      schedule,
      setInterval: ((callback: () => void) => {
        intervalCallback = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval,
      clearInterval: vi.fn() as unknown as typeof clearInterval,
    });
    await vi.waitFor(() => expect(loadEntries).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    entries = [entry({ chunkPath: 'chunks/smoke-b.js', sourceSignature: 'two' })];
    intervalCallback?.();

    await vi.waitFor(() => expect(loadEntries).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));
  });
});
