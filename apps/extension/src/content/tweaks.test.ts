import { describe, expect, it, vi } from 'vitest';
import {
  createReconcileScheduler,
  moduleKeyForEntry,
  shouldReapplyExperiment,
  shouldReapplyForTweakValues,
  stableTweakValuesKey,
} from './engine';

describe('content tweak reconcile helpers', () => {
  it('creates stable keys regardless of object insertion order', () => {
    expect(stableTweakValuesKey({ b: 2, a: 1 })).toBe(stableTweakValuesKey({ a: 1, b: 2 }));
  });

  it('detects when applied tweak values changed', () => {
    const current = stableTweakValuesKey({ headline: 'Before', enabled: true });

    expect(shouldReapplyForTweakValues(current, { enabled: true, headline: 'Before' })).toBe(false);
    expect(shouldReapplyForTweakValues(current, { enabled: true, headline: 'After' })).toBe(true);
  });

  it('requires apply when no values key exists yet', () => {
    expect(shouldReapplyForTweakValues(undefined, { enabled: true })).toBe(true);
  });

  it('detects module key changes even when tweak values are unchanged', () => {
    const values = { enabled: true };
    const appliedValuesKey = stableTweakValuesKey(values);

    expect(
      shouldReapplyExperiment({
        appliedValuesKey,
        nextValues: values,
        appliedModuleKey: moduleKeyForEntry({ chunkPath: 'old.js', sourceSignature: 'a' }),
        nextModuleKey: moduleKeyForEntry({ chunkPath: 'new.js', sourceSignature: 'b' }),
      }),
    ).toBe(true);
  });
});

describe('reconcile scheduler', () => {
  it('debounces rapid schedule calls into one reconcile', async () => {
    vi.useFakeTimers();
    const reconcile = vi.fn(async () => {});
    const scheduler = createReconcileScheduler(reconcile, { debounceMs: 50 });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(reconcile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);

    expect(reconcile).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('runs one follow-up reconcile when scheduled during an in-flight run', async () => {
    vi.useFakeTimers();
    let resolveFirst: (() => void) | undefined;
    let call = 0;
    const reconcile = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });
    const scheduler = createReconcileScheduler(reconcile, { debounceMs: 0 });

    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(0);

    expect(reconcile).toHaveBeenCalledTimes(1);
    resolveFirst?.();
    await vi.runAllTimersAsync();

    expect(reconcile).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
