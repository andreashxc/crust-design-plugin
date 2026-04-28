import type { ChatGptPopupOptions, ChatGptPopupResult } from '@platform/experiment-sdk';
import { sendMessage } from '@/shared/messages';

export const DEFAULT_CHATGPT_POPUP_OPTIONS = {
  width: 20,
  height: 20,
  top: 40,
  left: 20,
  loadTimeoutMs: 30_000,
  messageTimeoutMs: 30_000,
} satisfies Required<ChatGptPopupOptions>;

export type ChatGptPopupFlowArgs = {
  prompt: string;
  sourceWindowId?: number;
  sourceTabId?: number;
  options?: ChatGptPopupOptions;
};

export async function runChatGptPopupFlow(args: ChatGptPopupFlowArgs): Promise<ChatGptPopupResult> {
  try {
    const options = { ...DEFAULT_CHATGPT_POPUP_OPTIONS, ...args.options };
    const session = await createWorkerPopup(args.prompt, options);

    try {
      await waitForTabComplete(session.tabId, options.loadTimeoutMs);
      return await sendPageRunMessage(session.tabId, args.prompt, options.messageTimeoutMs);
    } finally {
      await chrome.windows.remove(session.windowId).catch(() => undefined);
      await restoreSourceFocus(args.sourceWindowId, args.sourceTabId);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function createWorkerPopup(
  prompt: string,
  options: Required<ChatGptPopupOptions>,
): Promise<{ windowId: number; tabId: number }> {
  const popup = await chrome.windows.create({
    url: `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`,
    type: 'popup',
    focused: true,
    width: options.width,
    height: options.height,
    top: options.top,
    left: options.left,
  });

  if (!popup) throw new Error('Failed to open ChatGPT popup.');

  const tab = popup.tabs?.[0];
  if (typeof popup.id !== 'number' || typeof tab?.id !== 'number') {
    throw new Error('Failed to open ChatGPT popup.');
  }

  return { windowId: popup.id, tabId: tab.id };
}

async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === 'complete') return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('ChatGPT popup did not finish loading.'));
    }, timeoutMs);

    function onUpdated(updatedTabId: number, changeInfo: { status?: string }) {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function sendPageRunMessage(
  tabId: number,
  prompt: string,
  timeoutMs: number,
): Promise<ChatGptPopupResult> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await sendMessage('CHATGPT_PAGE_RUN', { prompt }, tabId);

      if (response) return response;
    } catch (err) {
      lastError = err;
    }

    await sleep(300);
  }

  throw new Error(
    lastError instanceof Error ? lastError.message : 'Failed to communicate with the ChatGPT page.',
  );
}

async function restoreSourceFocus(sourceWindowId?: number, sourceTabId?: number): Promise<void> {
  if (typeof sourceWindowId === 'number') {
    await chrome.windows.update(sourceWindowId, { focused: true }).catch(() => undefined);
  }
  if (typeof sourceTabId === 'number') {
    await chrome.tabs.update(sourceTabId, { active: true }).catch(() => undefined);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
