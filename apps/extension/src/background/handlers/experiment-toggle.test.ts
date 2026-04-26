import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExperimentToggle } from './experiment-toggle';

describe('handleExperimentToggle (ENG-06 / D-13)', () => {
  beforeEach(() => {
    // Default: 2 tabs, both with content scripts.
    chrome.tabs.query = vi.fn(async () => [
      { id: 1 } as chrome.tabs.Tab,
      { id: 2 } as chrome.tabs.Tab,
    ]);
    chrome.tabs.sendMessage = vi.fn(async () => undefined);
  });

  it('toggle ON: writes enabled[id]=true and broadcasts STATE_CHANGED', async () => {
    const result = await handleExperimentToggle({
      id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
      enabled: true,
    });
    expect(result).toEqual({ ok: true });
    // chrome.storage.local._data['enabled'] is { '01J0...': true }
    // @ts-expect-error — _data introspection
    expect(chrome.storage.local._data.enabled).toEqual({
      '01J0AAAAAAAAAAAAAAAAAAAAAA': true,
    });
    // @ts-expect-error — _data introspection
    expect(chrome.storage.local._data.experiment_order).toEqual(['01J0AAAAAAAAAAAAAAAAAAAAAA']);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('toggle OFF: writes enabled[id]=false; does NOT clear autodisabled', async () => {
    // Seed pre-existing autodisabled state.
    await chrome.storage.local.set({
      autodisabled: { X: { reason: 'r', count: 3, firstAt: 0, lastAt: 0 } },
    });
    const result = await handleExperimentToggle({ id: 'X', enabled: false });
    expect(result).toEqual({ ok: true });
    // @ts-expect-error
    expect(chrome.storage.local._data.autodisabled).toEqual({
      X: { reason: 'r', count: 3, firstAt: 0, lastAt: 0 },
    });
    // STATE_CHANGED still broadcast.
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  describe('recovery (D-13: toggle ON clears autodisabled + error_window)', () => {
    it('clears autodisabled[id], error_window:<id>, and stale last_error[id]', async () => {
      // Seed pre-existing kill-switch + window.
      await chrome.storage.local.set({
        autodisabled: { X: { reason: 'r', count: 3, firstAt: 0, lastAt: 0 } },
        last_error: { X: { phase: 'apply', message: 'old failure', at: 1 } },
      });
      await chrome.storage.session.set({
        'error_window:X': { count: 2, firstAt: Date.now() },
      });

      const result = await handleExperimentToggle({ id: 'X', enabled: true });

      expect(result).toEqual({ ok: true });
      // @ts-expect-error — autodisabled.X gone
      expect(chrome.storage.local._data.autodisabled).toEqual({});
      // @ts-expect-error — stale last error gone
      expect(chrome.storage.local._data.last_error).toEqual({});
      // @ts-expect-error — window key gone
      expect('error_window:X' in chrome.storage.session._data).toBe(false);
    });
  });

  it('returns {ok:false, error} when storage write throws', async () => {
    const original = chrome.storage.local.set;
    chrome.storage.local.set = vi.fn(async () => {
      throw new Error('storage explode');
    });
    const result = await handleExperimentToggle({ id: 'X', enabled: true });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain('storage explode');
    }
    chrome.storage.local.set = original;
  });
});

describe('broadcastStateChanged (extracted from Phase 1)', () => {
  it('skips tabs with null id; swallows sendMessage rejection', async () => {
    const { broadcastStateChanged } = await import('@/background/broadcast');
    chrome.tabs.query = vi.fn(async () => [
      { id: 1 } as chrome.tabs.Tab,
      { id: undefined } as unknown as chrome.tabs.Tab, // simulate null
      { id: 3 } as chrome.tabs.Tab,
    ]);
    chrome.tabs.sendMessage = vi.fn(async (tabId: number) => {
      if (tabId === 3) throw new Error('no content script in tab 3');
      return undefined;
    });
    await expect(broadcastStateChanged()).resolves.toBeUndefined();
    // tab id 1 received message; tab id 3 errored but was swallowed; tab with null skipped.
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2); // id=1 + id=3 attempts
  });
});
