// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUrlChangeWatcher } from './url-change';

describe('createUrlChangeWatcher', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
    history.replaceState({}, '', '/');
  });

  it('emits on pushState, replaceState, popstate, and hashchange', async () => {
    const callback = vi.fn();
    cleanup = createUrlChangeWatcher(callback);

    history.pushState({}, '', '#push');
    history.replaceState({}, '', '#replace');
    location.hash = '#hash';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    history.back();
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(expect.stringContaining('#push')));

    expect(callback).toHaveBeenCalledWith(expect.stringContaining('#replace'));
    expect(callback).toHaveBeenCalledWith(expect.stringContaining('#hash'));
    await vi.waitFor(() => expect(callback.mock.calls.length).toBeGreaterThanOrEqual(4));
  });

  it('does not emit when pushState keeps the same URL', () => {
    const callback = vi.fn();
    cleanup = createUrlChangeWatcher(callback);

    history.pushState({}, '', location.href);

    expect(callback).not.toHaveBeenCalled();
  });

  it('restores history patch after cleanup', () => {
    const originalPushState = history.pushState;
    cleanup = createUrlChangeWatcher(vi.fn());

    expect(history.pushState).not.toBe(originalPushState);
    cleanup();
    cleanup = undefined;

    expect(history.pushState).toBe(originalPushState);
  });
});
