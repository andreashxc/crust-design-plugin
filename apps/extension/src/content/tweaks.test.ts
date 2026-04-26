import { describe, expect, it } from 'vitest';
import { shouldReapplyForTweakValues, stableTweakValuesKey } from './engine';

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
});
