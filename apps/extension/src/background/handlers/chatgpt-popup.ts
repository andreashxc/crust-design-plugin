import { runChatGptPopupFlow } from '@/background/chatgpt-popup';
import type { ChatGptPopupRequest } from '@/shared/messages';

export function handleChatGptPopupRun(
  data: ChatGptPopupRequest,
  sender: chrome.runtime.MessageSender,
) {
  const sourceTab = sender.tab;
  if (typeof sourceTab?.id !== 'number' || typeof sourceTab.windowId !== 'number') {
    return {
      ok: false,
      error: 'ChatGPT popup can only be started from a tab content script.',
    } as const;
  }

  return runChatGptPopupFlow({
    prompt: data.prompt,
    sourceTabId: sourceTab.id,
    sourceWindowId: sourceTab.windowId,
    options: data.options,
  });
}
