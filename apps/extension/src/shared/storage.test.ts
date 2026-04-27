import type {
  AutoDisableRecord,
  ErrorRecord,
  TweakValidationError,
} from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import {
  appendExperimentOrder,
  buildLlmCacheKey,
  clearAutoDisable,
  clearErrorWindow,
  clearLastError,
  clearLastErrorMap,
  clearLastLlmError,
  clearLlmCache,
  clearProviderKey,
  clearTweakErrors,
  clearTweakValues,
  defaultLlmSettings,
  getAppliedInTab,
  getAuthorGroupOpenState,
  getAutoDisabled,
  getEnabledExperiments,
  getErrorWindow,
  getExperimentOrder,
  getLastErrors,
  getLastLlmError,
  getLlmCache,
  getLlmSessionStats,
  getLlmSettings,
  getPublicLlmConfig,
  getTweakErrors,
  getTweakValues,
  getUpdateState,
  incrementLlmSessionStats,
  llmCacheStorageKey,
  recordLastError,
  resetLlmSessionStats,
  runStartupMigration,
  setAppliedInTab,
  setAuthorGroupOpenState,
  setAutoDisable,
  setEnabledExperiment,
  setErrorWindow,
  setExperimentOrder,
  setLastError,
  setLastLlmError,
  setLlmCache,
  setLlmDefaults,
  setProviderKey,
  setTweakErrors,
  setTweakValues,
  setUpdateState,
  sortRegistryByOrder,
} from './storage';

describe('storage adapter (D-12 stateless)', () => {
  it('getEnabledExperiments returns {} when storage is empty', async () => {
    await expect(getEnabledExperiments()).resolves.toEqual({});
  });

  it('setEnabledExperiment persists a single id', async () => {
    await setEnabledExperiment('01J0ABCDEFGHJKMNPQRSTVWXYZ', true);
    await expect(getEnabledExperiments()).resolves.toEqual({
      '01J0ABCDEFGHJKMNPQRSTVWXYZ': true,
    });
  });

  it('setEnabledExperiment merges with existing entries', async () => {
    await setEnabledExperiment('a', true);
    await setEnabledExperiment('b', false);
    const got = await getEnabledExperiments();
    expect(got).toEqual({ a: true, b: false });
  });

  it('setEnabledExperiment overwrites the same id', async () => {
    await setEnabledExperiment('a', true);
    await setEnabledExperiment('a', false);
    await expect(getEnabledExperiments()).resolves.toEqual({ a: false });
  });

  it('recordLastError writes into the last_error map (Phase 2 D-29)', async () => {
    await recordLastError('a', 'boom');
    const all = await chrome.storage.local.get(null as unknown as string);
    // Phase 2: recordLastError forwards into the consolidated last_error map.
    expect(all.last_error).toMatchObject({ a: { phase: 'apply', message: 'boom' } });
  });

  it('clearLastError removes the entry from the map', async () => {
    await recordLastError('a', 'boom');
    await clearLastError('a');
    const all = await chrome.storage.local.get(null as unknown as string);
    expect((all.last_error as Record<string, unknown>)?.a).toBeUndefined();
  });

  it('returns {} when storage value is malformed (string instead of object)', async () => {
    await chrome.storage.local.set({ enabled: 'not-an-object' });
    await expect(getEnabledExperiments()).resolves.toEqual({});
  });
});

describe('storage adapter — popup author group state', () => {
  it('round-trips author group open state and drops malformed values', async () => {
    await chrome.storage.local.set({
      'popup:author_group_open': {
        andrew: true,
        beth: false,
        invalid: 'yes',
        empty: null,
      },
    });

    await expect(getAuthorGroupOpenState()).resolves.toEqual({ andrew: true, beth: false });

    await setAuthorGroupOpenState({ andrew: false, beth: true });
    await expect(getAuthorGroupOpenState()).resolves.toEqual({ andrew: false, beth: true });
  });
});

describe('storage adapter (Phase 2 helpers — D-09 / D-12 / D-28)', () => {
  describe('last_error map (D-29 promoted shape)', () => {
    it('getLastErrors returns {} when storage is empty', async () => {
      await expect(getLastErrors()).resolves.toEqual({});
    });

    it('setLastError + getLastErrors round-trip', async () => {
      const rec: ErrorRecord = { phase: 'apply', message: 'boom', at: 1000 };
      await setLastError('01J0AAAAAAAAAAAAAAAAAAAAAA', rec);
      await expect(getLastErrors()).resolves.toEqual({
        '01J0AAAAAAAAAAAAAAAAAAAAAA': rec,
      });
    });

    it('clearLastErrorMap removes the entry but keeps siblings', async () => {
      await setLastError('A', { phase: 'apply', message: 'a', at: 1 });
      await setLastError('B', { phase: 'apply', message: 'b', at: 2 });
      await clearLastErrorMap('A');
      const got = await getLastErrors();
      expect(got).toEqual({ B: { phase: 'apply', message: 'b', at: 2 } });
    });
  });

  describe('autodisabled map (D-12 persistent kill-switch)', () => {
    it('getAutoDisabled returns {} when storage is empty', async () => {
      await expect(getAutoDisabled()).resolves.toEqual({});
    });

    it('setAutoDisable + getAutoDisabled round-trip', async () => {
      const rec: AutoDisableRecord = {
        reason: '≥3 errors in 10s',
        count: 3,
        firstAt: 1000,
        lastAt: 2000,
      };
      await setAutoDisable('01J0AAAAAAAAAAAAAAAAAAAAAA', rec);
      await expect(getAutoDisabled()).resolves.toEqual({
        '01J0AAAAAAAAAAAAAAAAAAAAAA': rec,
      });
    });

    it('clearAutoDisable removes the entry but keeps siblings', async () => {
      await setAutoDisable('A', { reason: 'r', count: 3, firstAt: 1, lastAt: 2 });
      await setAutoDisable('B', { reason: 'r', count: 3, firstAt: 1, lastAt: 2 });
      await clearAutoDisable('A');
      const got = await getAutoDisabled();
      expect(Object.keys(got)).toEqual(['B']);
    });
  });

  describe('error_window:<id> (D-09 storage.session sliding window)', () => {
    it('returns undefined when key absent', async () => {
      await expect(getErrorWindow('A')).resolves.toBeUndefined();
    });

    it('setErrorWindow lands at storage.session._data["error_window:<id>"]', async () => {
      await setErrorWindow('A', { count: 1, firstAt: 1000 });
      // @ts-expect-error — _data is a test-only introspection field on the mock
      expect(chrome.storage.session._data['error_window:A']).toEqual({
        count: 1,
        firstAt: 1000,
      });
    });

    it('clearErrorWindow removes the entry', async () => {
      await setErrorWindow('A', { count: 1, firstAt: 1000 });
      await clearErrorWindow('A');
      await expect(getErrorWindow('A')).resolves.toBeUndefined();
    });
  });

  describe('applied:<tabId> (D-09 storage.session per-tab applied set)', () => {
    it('returns [] when key absent', async () => {
      await expect(getAppliedInTab(42)).resolves.toEqual([]);
    });

    it('setAppliedInTab lands at storage.session._data["applied:<tabId>"]', async () => {
      await setAppliedInTab(42, ['01J0AAAA', '01J0BBBB']);
      // @ts-expect-error — _data introspection
      expect(chrome.storage.session._data['applied:42']).toEqual(['01J0AAAA', '01J0BBBB']);
    });

    it('round-trip via getAppliedInTab returns the same array', async () => {
      await setAppliedInTab(7, ['X']);
      await expect(getAppliedInTab(7)).resolves.toEqual(['X']);
    });
  });
});

describe('storage adapter (Phase 5 experiment order)', () => {
  it('getExperimentOrder returns [] when storage is empty or malformed', async () => {
    await expect(getExperimentOrder()).resolves.toEqual([]);

    await chrome.storage.local.set({ experiment_order: 'bad' });
    await expect(getExperimentOrder()).resolves.toEqual([]);
  });

  it('setExperimentOrder stores unique string ids', async () => {
    await setExperimentOrder(['B', 'A', 'B', '']);

    await expect(getExperimentOrder()).resolves.toEqual(['B', 'A']);
  });

  it('appendExperimentOrder appends without duplicates', async () => {
    await appendExperimentOrder('A');
    await appendExperimentOrder('B');
    await appendExperimentOrder('A');

    await expect(getExperimentOrder()).resolves.toEqual(['A', 'B']);
  });

  it('sortRegistryByOrder places ordered ids first and appends unknown ids in registry order', () => {
    expect(sortRegistryByOrder([{ id: 'A' }, { id: 'B' }, { id: 'C' }], ['C', 'A'])).toEqual([
      { id: 'C' },
      { id: 'A' },
      { id: 'B' },
    ]);
  });
});

describe('storage adapter (Phase 5 update state)', () => {
  it('returns null when update state is missing or malformed', async () => {
    await expect(getUpdateState()).resolves.toBeNull();

    await chrome.storage.local.set({ 'update:state': 'bad' });
    await expect(getUpdateState()).resolves.toBeNull();
  });

  it('round-trips update state', async () => {
    await setUpdateState({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      remoteCommit: 'def',
      available: true,
      checkedAt: 123,
      url: 'https://github.com/andreashxc/overlay-plugin/compare/abc...main',
    });

    await expect(getUpdateState()).resolves.toMatchObject({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      remoteCommit: 'def',
      available: true,
      checkedAt: 123,
    });
  });
});

describe('storage adapter (Phase 3 tweak helpers)', () => {
  describe('tweaks:<id> values', () => {
    it('round-trips tweak values', async () => {
      await setTweakValues('A', {
        enabled: true,
        label: 'compact',
        limit: 3,
      });

      await expect(getTweakValues('A')).resolves.toEqual({
        enabled: true,
        label: 'compact',
        limit: 3,
      });
    });

    it('returns {} when tweak values are missing or malformed', async () => {
      await expect(getTweakValues('A')).resolves.toEqual({});

      await chrome.storage.local.set({ 'tweaks:A': 'not-an-object' });
      await expect(getTweakValues('A')).resolves.toEqual({});

      await chrome.storage.local.set({ 'tweaks:A': ['not', 'an', 'object'] });
      await expect(getTweakValues('A')).resolves.toEqual({});
    });

    it('clearTweakValues removes the per-experiment key', async () => {
      await setTweakValues('A', { enabled: true });
      await clearTweakValues('A');

      await expect(getTweakValues('A')).resolves.toEqual({});
      // @ts-expect-error — _data is a test-only introspection field on the mock
      expect('tweaks:A' in chrome.storage.local._data).toBe(false);
    });
  });

  describe('tweak_errors:<id> validation errors', () => {
    it('setTweakErrors + getTweakErrors round-trip', async () => {
      const errors: TweakValidationError[] = [
        { path: ['color'], message: 'Expected color', code: 'invalid_type' },
        { path: ['count'], message: 'Too small' },
      ];

      await setTweakErrors('A', errors);

      await expect(getTweakErrors('A')).resolves.toEqual(errors);
    });

    it('returns [] when tweak errors are missing or malformed', async () => {
      await expect(getTweakErrors('A')).resolves.toEqual([]);

      await chrome.storage.local.set({ 'tweak_errors:A': { message: 'not-an-array' } });
      await expect(getTweakErrors('A')).resolves.toEqual([]);
    });

    it('clearTweakErrors removes the per-experiment key', async () => {
      await setTweakErrors('A', [{ message: 'Expected boolean' }]);
      await clearTweakErrors('A');

      await expect(getTweakErrors('A')).resolves.toEqual([]);
      // @ts-expect-error — _data is a test-only introspection field on the mock
      expect('tweak_errors:A' in chrome.storage.local._data).toBe(false);
    });
  });
});

describe('storage adapter (Phase 4 LLM helpers)', () => {
  it('returns safe default LLM settings when storage is empty or malformed', async () => {
    await expect(getLlmSettings()).resolves.toEqual(defaultLlmSettings());

    await chrome.storage.local.set({ 'llm:settings': 'bad' });
    await expect(getLlmSettings()).resolves.toEqual(defaultLlmSettings());
  });

  it('stores provider keys but excludes them from public config', async () => {
    await setProviderKey('openai', ' sk-test ');
    await setProviderKey('anthropic', 'sk-ant-test');

    await expect(getLlmSettings()).resolves.toMatchObject({
      providerKeys: { openai: 'sk-test', anthropic: 'sk-ant-test' },
    });

    await expect(getPublicLlmConfig()).resolves.toEqual({
      defaultProvider: 'openai',
      models: defaultLlmSettings().models,
      costGuard: defaultLlmSettings().costGuard,
      providers: {
        openai: { configured: true },
        anthropic: { configured: true },
      },
    });
  });

  it('clears provider keys without removing sibling providers', async () => {
    await setProviderKey('openai', 'sk-openai');
    await setProviderKey('anthropic', 'sk-anthropic');
    await clearProviderKey('openai');

    await expect(getLlmSettings()).resolves.toMatchObject({
      providerKeys: { anthropic: 'sk-anthropic' },
    });
  });

  it('updates provider defaults and cost guard settings', async () => {
    await setLlmDefaults({
      defaultProvider: 'anthropic',
      models: { openai: 'gpt-custom', anthropic: 'claude-custom' },
      costGuard: { cacheTtlMs: 5_000, maxAttempts: 2, maxOutputTokens: 128 },
    });

    await expect(getLlmSettings()).resolves.toMatchObject({
      defaultProvider: 'anthropic',
      models: { openai: 'gpt-custom', anthropic: 'claude-custom' },
      costGuard: { cacheTtlMs: 5_000, maxAttempts: 2, maxOutputTokens: 128 },
    });
  });

  it('builds deterministic cache keys from provider, model, prompt, max tokens and caller key', () => {
    const base = {
      provider: 'openai' as const,
      model: 'gpt-test',
      prompt: 'hello',
      maxOutputTokens: 128,
    };

    expect(buildLlmCacheKey(base)).toBe(buildLlmCacheKey({ ...base }));
    expect(buildLlmCacheKey(base)).not.toBe(buildLlmCacheKey({ ...base, provider: 'anthropic' }));
    expect(buildLlmCacheKey(base)).not.toBe(buildLlmCacheKey({ ...base, model: 'other' }));
    expect(buildLlmCacheKey(base)).not.toBe(buildLlmCacheKey({ ...base, prompt: 'bye' }));
    expect(buildLlmCacheKey(base)).not.toBe(buildLlmCacheKey({ ...base, maxOutputTokens: 256 }));
    expect(buildLlmCacheKey(base)).not.toBe(buildLlmCacheKey({ ...base, cacheKey: 'custom' }));
  });

  it('round-trips valid cache entries and ignores expired cache', async () => {
    const hash = 'abc123';
    await setLlmCache(hash, {
      text: 'hello',
      provider: 'openai',
      model: 'gpt-test',
      cachedAt: 1000,
      expiresAt: Date.now() + 60_000,
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });

    await expect(getLlmCache(hash)).resolves.toMatchObject({ text: 'hello' });

    await setLlmCache('expired', {
      text: 'old',
      provider: 'openai',
      model: 'gpt-test',
      cachedAt: 1000,
      expiresAt: Date.now() - 1,
    });
    await expect(getLlmCache('expired')).resolves.toBeUndefined();
    // @ts-expect-error — _data is a test-only introspection field on the mock
    expect(llmCacheStorageKey('expired') in chrome.storage.local._data).toBe(false);
  });

  it('clearLlmCache removes only cache entries', async () => {
    await setProviderKey('openai', 'sk-test');
    await setLlmCache('one', {
      text: 'one',
      provider: 'openai',
      model: 'gpt-test',
      cachedAt: 1,
      expiresAt: Date.now() + 1000,
    });

    await clearLlmCache();

    await expect(getLlmCache('one')).resolves.toBeUndefined();
    await expect(getPublicLlmConfig()).resolves.toMatchObject({
      providers: { openai: { configured: true } },
    });
  });

  it('stores LLM session counters in storage.session', async () => {
    const initial = await getLlmSessionStats();
    expect(initial.calls).toBe(0);

    await incrementLlmSessionStats({
      calls: 1,
      cacheHits: 1,
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });

    await expect(getLlmSessionStats()).resolves.toMatchObject({
      calls: 1,
      cacheHits: 1,
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });
    // @ts-expect-error — _data is a test-only introspection field on the mock
    expect(chrome.storage.session._data['llm:session']).toMatchObject({ calls: 1 });

    await resetLlmSessionStats();
    await expect(getLlmSessionStats()).resolves.toMatchObject({ calls: 0, totalTokens: 0 });
  });

  it('round-trips and clears last LLM error', async () => {
    await setLastLlmError({ provider: 'anthropic', message: 'failed', code: 'rate_limit', at: 1 });
    await expect(getLastLlmError()).resolves.toEqual({
      provider: 'anthropic',
      message: 'failed',
      code: 'rate_limit',
      at: 1,
    });

    await clearLastLlmError();
    await expect(getLastLlmError()).resolves.toBeUndefined();
  });
});

describe('runStartupMigration (D-29)', () => {
  it('first run: consolidates last_error:<id> into the last_error map', async () => {
    // Seed Phase 1 shape: per-key last_error:<id> entries.
    await chrome.storage.local.set({
      'last_error:01J0AAAAAAAAAAAAAAAAAAAAAA': 'old apply error',
      'last_error:01J0BBBBBBBBBBBBBBBBBBBBBB': 'another error',
    });

    await runStartupMigration();

    const map = await getLastErrors();
    expect(Object.keys(map).sort()).toEqual([
      '01J0AAAAAAAAAAAAAAAAAAAAAA',
      '01J0BBBBBBBBBBBBBBBBBBBBBB',
    ]);
    expect(map['01J0AAAAAAAAAAAAAAAAAAAAAA']).toMatchObject({
      phase: 'apply',
      message: 'old apply error',
    });

    // Old per-key entries removed.
    const all = await chrome.storage.local.get(null as unknown as string);
    const stillOld = Object.keys(all).filter(
      (k) => k.startsWith('last_error:') && k !== 'last_error',
    );
    expect(stillOld).toEqual([]);

    // _migrations marker recorded.
    expect(all._migrations).toContain('last_error_to_map_v1');
  });

  it('second run is a no-op (idempotent)', async () => {
    await chrome.storage.local.set({
      _migrations: ['last_error_to_map_v1'],
      last_error: { A: { phase: 'apply', message: 'preserved', at: 99 } },
    });
    await runStartupMigration();
    const map = await getLastErrors();
    expect(map.A).toEqual({ phase: 'apply', message: 'preserved', at: 99 });
  });

  it('empty store: marks done without writing last_error', async () => {
    await runStartupMigration();
    const all = await chrome.storage.local.get(null as unknown as string);
    expect(all._migrations).toContain('last_error_to_map_v1');
    expect(all.last_error).toBeUndefined();
  });
});

describe('ULID-keyed storage survives folder rename (MAN-03 / D-28)', () => {
  it('storage helpers are keyed by ULID, not folder path', async () => {
    const ULID = '01J0AAAAAAAAAAAAAAAAAAAAAA';
    // Set via ULID-only API.
    await setEnabledExperiment(ULID, true);
    await setLastError(ULID, { phase: 'apply', message: 'boom', at: 0 });
    await setAutoDisable(ULID, { reason: 'r', count: 3, firstAt: 0, lastAt: 0 });

    // "Rename" simulation: the storage stays the same; only the file system changes (untestable here).
    // Assertion: helpers find the entries by ULID with no path argument anywhere.
    await expect(getEnabledExperiments()).resolves.toEqual({ [ULID]: true });
    await expect(getLastErrors()).resolves.toMatchObject({
      [ULID]: { phase: 'apply', message: 'boom' },
    });
    await expect(getAutoDisabled()).resolves.toMatchObject({
      [ULID]: { count: 3 },
    });
  });
});
