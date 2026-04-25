import { describe, expect, it } from 'vitest';
import {
  clearLastError,
  getEnabledExperiments,
  recordLastError,
  setEnabledExperiment,
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

  it('recordLastError writes under last_error:<id>', async () => {
    await recordLastError('a', 'boom');
    const all = await chrome.storage.local.get(null as unknown as string);
    expect(all).toMatchObject({ 'last_error:a': 'boom' });
  });

  it('clearLastError removes the entry', async () => {
    await recordLastError('a', 'boom');
    await clearLastError('a');
    const all = await chrome.storage.local.get(null as unknown as string);
    expect(all).not.toHaveProperty('last_error:a');
  });

  it('returns {} when storage value is malformed (string instead of object)', async () => {
    await chrome.storage.local.set({ enabled: 'not-an-object' });
    await expect(getEnabledExperiments()).resolves.toEqual({});
  });
});
