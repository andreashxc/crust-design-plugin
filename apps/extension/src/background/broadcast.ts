/**
 * Per-tab STATE_CHANGED broadcast helper (`broadcastStateChanged`).
 *
 * Extracted from Phase 1 background.ts:39-49. Phase 2 uses sendMessage from
 * @webext-core/messaging and includes {tabId} in each per-tab payload
 * (RESEARCH R8) so content scripts can cache their own tab id on first
 * STATE_CHANGED dispatch (no Chrome API for "my tab id" without a roundtrip).
 *
 * SP-2: per-tab try/catch — a tab with no content script throws and is
 * silently swallowed; other tabs still receive the broadcast.
 */
import { sendMessage } from '@/shared/messages';

export async function broadcastStateChanged(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await sendMessage('STATE_CHANGED', { tabId: tab.id }, tab.id);
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}
