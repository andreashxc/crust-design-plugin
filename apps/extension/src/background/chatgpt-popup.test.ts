import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleChatGptPopupRun } from '@/background/handlers/chatgpt-popup';
import { runChatGptPopupFlow } from './chatgpt-popup';

describe('runChatGptPopupFlow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens ChatGPT with the encoded prompt, sends the page message, closes, and restores focus', async () => {
    chrome.windows.create = vi.fn(async () => ({
      id: 12,
      tabs: [{ id: 34, status: 'complete' }],
    }));
    chrome.tabs.sendMessage = vi.fn(async () => ({ ok: true, text: 'done' }));

    await expect(
      runChatGptPopupFlow({
        prompt: 'hello world',
        sourceWindowId: 9,
        sourceTabId: 8,
      }),
    ).resolves.toEqual({ ok: true, text: 'done' });

    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://chatgpt.com/?prompt=hello%20world',
        type: 'popup',
        focused: true,
      }),
    );
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(34, {
      name: 'CHATGPT_PAGE_RUN',
      data: { prompt: 'hello world' },
    });
    expect(chrome.windows.remove).toHaveBeenCalledWith(12);
    expect(chrome.windows.update).toHaveBeenCalledWith(9, { focused: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(8, { active: true });
  });

  it('waits for the popup tab to finish loading before messaging it', async () => {
    chrome.windows.create = vi.fn(async () => ({
      id: 12,
      tabs: [{ id: 34, status: 'loading' }],
    }));
    chrome.tabs.get = vi.fn(async () => ({ id: 34, status: 'loading' }));
    chrome.tabs.sendMessage = vi.fn(async () => ({ ok: true, text: 'after load' }));

    const promise = runChatGptPopupFlow({
      prompt: 'load',
      options: { loadTimeoutMs: 1_000 },
    });
    await vi.waitFor(() => expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled());

    const listener = vi.mocked(chrome.tabs.onUpdated.addListener).mock.calls[0]?.[0] as
      | ((tabId: number, changeInfo: { status?: string }) => void)
      | undefined;
    expect(listener).toBeTypeOf('function');
    listener?.(34, { status: 'complete' });

    await expect(promise).resolves.toEqual({ ok: true, text: 'after load' });
  });

  it('retries page messaging until the bridge responds', async () => {
    vi.useFakeTimers();
    chrome.windows.create = vi.fn(async () => ({
      id: 12,
      tabs: [{ id: 34, status: 'complete' }],
    }));
    chrome.tabs.sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce({ ok: true, text: 'ready' });

    const promise = runChatGptPopupFlow({
      prompt: 'retry',
      options: { messageTimeoutMs: 2_000 },
    });

    await vi.advanceTimersByTimeAsync(300);

    await expect(promise).resolves.toEqual({ ok: true, text: 'ready' });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('closes and restores focus when the ChatGPT bridge returns an error', async () => {
    chrome.windows.create = vi.fn(async () => ({
      id: 12,
      tabs: [{ id: 34, status: 'complete' }],
    }));
    chrome.tabs.sendMessage = vi.fn(async () => ({ ok: false, error: 'dom changed' }));

    await expect(
      runChatGptPopupFlow({
        prompt: 'fail',
        sourceWindowId: 9,
        sourceTabId: 8,
      }),
    ).resolves.toEqual({ ok: false, error: 'dom changed' });

    expect(chrome.windows.remove).toHaveBeenCalledWith(12);
    expect(chrome.windows.update).toHaveBeenCalledWith(9, { focused: true });
    expect(chrome.tabs.update).toHaveBeenCalledWith(8, { active: true });
  });
});

describe('handleChatGptPopupRun', () => {
  it('rejects requests that do not come from a tab content script', async () => {
    expect(await handleChatGptPopupRun({ experimentId: 'x', prompt: 'hello' }, {})).toMatchObject({
      ok: false,
      error: expect.stringContaining('content script'),
    });
  });
});
