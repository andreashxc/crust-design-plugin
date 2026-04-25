import type { AutoDisableRecord, ErrorRecord } from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import {
  clearAutoDisable,
  clearErrorWindow,
  clearLastError,
  clearLastErrorMap,
  getAppliedInTab,
  getAutoDisabled,
  getEnabledExperiments,
  getErrorWindow,
  getLastErrors,
  recordLastError,
  runStartupMigration,
  setAppliedInTab,
  setAutoDisable,
  setEnabledExperiment,
  setErrorWindow,
  setLastError,
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
