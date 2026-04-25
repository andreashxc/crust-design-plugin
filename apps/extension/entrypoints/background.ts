/**
 * Service worker entry.
 *
 * CRITICAL — SP-7 / Pitfall 1 / R7 / A3:
 *   chrome.runtime.onMessage.addListener MUST run at module top-level so the
 *   listener exists in the SW's global scope BEFORE Chrome dispatches an event.
 *   If it lived inside defineBackground's main() callback, it could miss the
 *   wake-up event after a ~30s idle termination.
 *
 * Per CONTEXT D-12 / SP-1: ZERO module-scope state. All persistence flows through
 * apps/extension/src/shared/storage.ts.
 */

import { defineBackground } from 'wxt/utils/define-background';
import { isExtensionMessage } from '@/shared/messages';
import { setEnabledExperiment } from '@/shared/storage';

// ===== TOP-LEVEL LISTENER (SP-7) =====
// Registered immediately on SW startup, before any await, before defineBackground runs.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isExtensionMessage(msg)) return false;

  if (msg.type === 'EXPERIMENT_TOGGLE') {
    // Stateless handler: read+write storage, broadcast to tabs, reply.
    handleToggle(msg.id, msg.enabled)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => {
        console.error('[bg] toggle failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep channel open for async sendResponse
  }
  return false;
});

async function handleToggle(id: string, enabled: boolean): Promise<void> {
  await setEnabledExperiment(id, enabled);
  // Broadcast STATE_CHANGED to every tab; per-tab errors (no content script) are suppressed.
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED' });
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}

// ===== WXT-DEFINED MAIN (kept near-empty per SP-7) =====
export default defineBackground(() => {
  // Intentionally empty. State lives in chrome.storage.local; listeners live above.
});
