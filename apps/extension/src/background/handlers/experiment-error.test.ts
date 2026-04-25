import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExperimentError } from './experiment-error';

describe('handleExperimentError (ENG-06 / D-11 sliding window)', () => {
  beforeEach(() => {
    chrome.tabs.query = vi.fn(async () => []);
    chrome.tabs.sendMessage = vi.fn(async () => undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1st error: opens window with count=1', async () => {
    const result = await handleExperimentError({
      id: 'X',
      phase: 'apply',
      message: 'boom',
    });
    expect(result).toEqual({ ok: true });
    // @ts-expect-error — _data introspection
    expect(chrome.storage.session._data['error_window:X']).toEqual({ count: 1, firstAt: 1000 });
    // @ts-expect-error
    expect(chrome.storage.local._data.autodisabled).toBeUndefined();
  });

  it('2nd error within 10s: count=2', async () => {
    await chrome.storage.session.set({ 'error_window:X': { count: 1, firstAt: 1000 } });
    vi.setSystemTime(new Date(2_000));
    await handleExperimentError({ id: 'X', phase: 'apply', message: 'boom' });
    // @ts-expect-error
    expect(chrome.storage.session._data['error_window:X']).toEqual({ count: 2, firstAt: 1000 });
  });

  it('3rd error within 10s: trips auto-disable + clears window + broadcasts', async () => {
    await chrome.storage.session.set({ 'error_window:X': { count: 2, firstAt: 1000 } });
    chrome.tabs.query = vi.fn(async () => [{ id: 7 } as chrome.tabs.Tab]);
    vi.setSystemTime(new Date(3_000));

    await handleExperimentError({ id: 'X', phase: 'cleanup', message: 'thrice' });

    // @ts-expect-error
    const autodisabled = chrome.storage.local._data.autodisabled as Record<string, unknown>;
    expect(autodisabled.X).toMatchObject({
      reason: '≥3 errors in 10s',
      count: 3,
      firstAt: 1000,
      lastAt: 3000,
    });
    // window cleared so re-arm starts clean (D-13).
    // @ts-expect-error
    expect('error_window:X' in chrome.storage.session._data).toBe(false);
    // STATE_CHANGED broadcast happened (one tab queried).
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  it('error after window expiry: resets to count=1, firstAt=now', async () => {
    await chrome.storage.session.set({ 'error_window:X': { count: 2, firstAt: 0 } });
    vi.setSystemTime(new Date(11_000)); // > 10s past firstAt=0

    await handleExperimentError({ id: 'X', phase: 'apply', message: 'fresh' });

    // @ts-expect-error
    expect(chrome.storage.session._data['error_window:X']).toEqual({
      count: 1,
      firstAt: 11_000,
    });
    // @ts-expect-error — no auto-disable on 1st-of-new-window error
    expect(chrome.storage.local._data.autodisabled).toBeUndefined();
  });

  it('always writes last_error[id] with {phase, message, stack?, at}', async () => {
    vi.setSystemTime(new Date(5_000));
    await handleExperimentError({
      id: 'X',
      phase: 'cleanup',
      message: 'msg',
      stack: 'stack-trace-here',
    });
    // @ts-expect-error
    const lastErrors = chrome.storage.local._data.last_error as Record<string, unknown>;
    expect(lastErrors.X).toEqual({
      phase: 'cleanup',
      message: 'msg',
      stack: 'stack-trace-here',
      at: 5000,
    });
  });

  it('returns {ok: true} regardless of trip', async () => {
    const r1 = await handleExperimentError({ id: 'A', phase: 'apply', message: 'x' });
    expect(r1).toEqual({ ok: true });
    // 3 errors in a row -> trips
    await handleExperimentError({ id: 'A', phase: 'apply', message: 'x' });
    const r3 = await handleExperimentError({ id: 'A', phase: 'apply', message: 'x' });
    expect(r3).toEqual({ ok: true });
  });
});
