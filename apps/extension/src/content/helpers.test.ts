// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHelperContext } from './helpers';

describe('createHelperContext', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('tracks injected styles and nodes for cleanup', async () => {
    const context = createHelperContext({ experimentId: 'exp' });
    const style = context.helpers.injectStyle('body { color: red; }');
    const node = context.helpers.injectNode(document.createElement('section'));

    expect(style.dataset.expId).toBe('exp');
    expect(style.isConnected).toBe(true);
    expect(node.isConnected).toBe(true);

    await context.cleanup();

    expect(style.isConnected).toBe(false);
    expect(node.isConnected).toBe(false);
  });

  it('waitFor resolves when a matching node appears and disconnects on cleanup', async () => {
    const context = createHelperContext({ experimentId: 'exp' });
    const promise = context.helpers.waitFor<HTMLDivElement>('.target', { timeoutMs: 1000 });
    const div = document.createElement('div');
    div.className = 'target';
    document.body.append(div);

    await expect(promise).resolves.toBe(div);
    await context.cleanup();
  });

  it('abort rejects pending waitFor with AbortError', async () => {
    const controller = new AbortController();
    const context = createHelperContext({ experimentId: 'exp', signal: controller.signal });
    const promise = context.helpers.waitFor('.missing');

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await context.cleanup();
  });

  it('onUrlChange patches and restores history methods', async () => {
    const context = createHelperContext({ experimentId: 'exp' });
    const originalPush = history.pushState;
    const callback = vi.fn();

    const cleanup = context.helpers.onUrlChange(callback);
    history.pushState({}, '', '#next');

    expect(callback).toHaveBeenCalled();
    cleanup();
    expect(history.pushState).toBe(originalPush);
    await context.cleanup();
  });

  it('streaming llm rejects explicitly when the port closes before done', async () => {
    const messageListeners: Array<(message: unknown) => void> = [];
    const disconnectListeners: Array<() => void> = [];
    const port = {
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: {
        addListener: vi.fn((listener: (message: unknown) => void) => {
          messageListeners.push(listener);
        }),
      },
      onDisconnect: {
        addListener: vi.fn((listener: () => void) => {
          disconnectListeners.push(listener);
        }),
      },
    };
    chrome.runtime.connect = vi.fn(() => port as unknown as chrome.runtime.Port);
    const context = createHelperContext({ experimentId: 'exp' });

    const promise = context.helpers.llm('hello', { stream: true });
    for (const listener of messageListeners) listener({ type: 'delta', delta: 'partial' });
    for (const listener of disconnectListeners) listener();

    await expect(promise).rejects.toThrow('LLM stream closed before completion: partial');
  });
});
