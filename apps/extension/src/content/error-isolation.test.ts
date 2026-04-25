import type { ApplyFn, ExperimentManifest } from '@platform/experiment-sdk';
import { describe, expect, it, vi } from 'vitest';
import { type LoadedExperiment, runEngine } from './engine';

function makeManifest(id: string, world: 'isolated' | 'main' = 'isolated'): ExperimentManifest {
  return {
    id,
    name: id,
    author: 'andrew',
    description: 'd',
    scope: { match: ['*://ya.ru/*'] },
    world,
    tweaks: [],
  };
}

function makeExperiment(
  id: string,
  apply: ApplyFn,
  world: 'isolated' | 'main' = 'isolated',
): LoadedExperiment {
  return {
    manifest: makeManifest(id, world),
    load: async () => ({ apply }),
  };
}

describe('runEngine error isolation (D-14 / ENG-05 / SP-2)', () => {
  it('a throwing apply() does not prevent subsequent applies', async () => {
    const okApply = vi.fn(async () => () => {});
    const failingApply: ApplyFn = () => {
      throw new Error('boom');
    };

    const result = await runEngine({
      experiments: [
        makeExperiment('01J0AAAAAAAAAAAAAAAAAAAAAA', failingApply),
        makeExperiment('01J0BBBBBBBBBBBBBBBBBBBBBB', okApply),
      ],
      world: 'isolated',
      currentURL: 'https://ya.ru/',
    });

    expect(result.failed).toContain('01J0AAAAAAAAAAAAAAAAAAAAAA');
    expect(result.applied).toContain('01J0BBBBBBBBBBBBBBBBBBBBBB');
    expect(okApply).toHaveBeenCalledTimes(1);
  });

  it('records last_error[id] in chrome.storage.local for failures', async () => {
    const failingApply: ApplyFn = () => {
      throw new Error('explicit-error-message');
    };

    await runEngine({
      experiments: [makeExperiment('01J0AAAAAAAAAAAAAAAAAAAAAA', failingApply)],
      world: 'isolated',
      currentURL: 'https://ya.ru/',
    });

    // Phase 2 D-29: last_error is now a consolidated map under one key.
    const stored = await chrome.storage.local.get('last_error');
    const map = stored.last_error as Record<string, { message: string }> | undefined;
    expect(map?.['01J0AAAAAAAAAAAAAAAAAAAAAA']?.message).toContain('explicit-error-message');
  });

  it('async apply() rejection is caught and other experiments still run', async () => {
    const rejectingApply: ApplyFn = async () => {
      throw new Error('async-boom');
    };
    const okApply: ApplyFn = async () => () => {};

    const result = await runEngine({
      experiments: [
        makeExperiment('01J0AAAAAAAAAAAAAAAAAAAAAA', rejectingApply),
        makeExperiment('01J0BBBBBBBBBBBBBBBBBBBBBB', okApply),
      ],
      world: 'isolated',
      currentURL: 'https://ya.ru/',
    });

    expect(result.failed).toEqual(['01J0AAAAAAAAAAAAAAAAAAAAAA']);
    expect(result.applied).toEqual(['01J0BBBBBBBBBBBBBBBBBBBBBB']);
  });

  it('experiments in non-matching world are skipped (not failed)', async () => {
    const apply: ApplyFn = async () => () => {};
    const result = await runEngine({
      experiments: [makeExperiment('01J0AAAAAAAAAAAAAAAAAAAAAA', apply, 'main')],
      world: 'isolated',
      currentURL: 'https://ya.ru/',
    });
    expect(result.applied).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it('apply args include {tweaks: {}, helpers: {log}, signal, currentURL}', async () => {
    const captured: Parameters<ApplyFn>[0][] = [];
    const apply: ApplyFn = (args) => {
      captured.push(args);
      return () => {};
    };

    await runEngine({
      experiments: [makeExperiment('01J0AAAAAAAAAAAAAAAAAAAAAA', apply)],
      world: 'isolated',
      currentURL: 'https://ya.ru/path',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.tweaks).toEqual({});
    expect(captured[0]?.currentURL).toBe('https://ya.ru/path');
    expect(typeof captured[0]?.helpers.log).toBe('function');
    expect(typeof captured[0]?.log).toBe('function');
    expect(captured[0]?.signal).toBeInstanceOf(AbortSignal);
  });
});
