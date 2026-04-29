/**
 * Service worker entry.
 *
 * Phase 2 evolution of Phase 1's SP-7 contract (per CONTEXT D-04, D-06, D-07):
 *  - Replaces hand-rolled tag-union onMessage with @webext-core/messaging's
 *    onMessage(name, handler), which registers the underlying chrome runtime
 *    listener synchronously at module-import time (RESEARCH R1).
 *  - Splits handler bodies into typed handlers under src/background/handlers/.
 *  - Runs idempotent storage migration (D-29) BEFORE handler registration
 *    (RESEARCH R7 — migration must precede any handler that reads/writes
 *    last_error).
 *  - Registers chrome.tabs.onRemoved at top level to clean up stale
 *    applied:<tabId> session-storage keys (RESEARCH §11).
 *  - Inside defineBackground main(), calls
 *    chrome.storage.session.setAccessLevel({accessLevel:
 *    'TRUSTED_AND_UNTRUSTED_CONTEXTS'}) (RESEARCH R6) so content scripts
 *    can write applied:<tabId> in Plan 02-07.
 *  - WHO_AM_I handler (Blocker 2 fix) lets content scripts fetch their own
 *    tab id during bootstrap (BEFORE the first STATE_CHANGED) so
 *    applied:<tabId> writes happen on initial page load.
 *
 * SP-1 preserved: ZERO module-scope state; all persistence via storage.ts.
 * SP-7 preserved: top-level listener registrations BEFORE defineBackground.
 */
import { defineBackground } from 'wxt/utils/define-background';
import { setActionIconTheme, setAppliedCountBadge } from '@/background/action-icon';
import { broadcastStateChanged } from '@/background/broadcast';
import { handleChatGptPopupRun } from '@/background/handlers/chatgpt-popup';
import { handleExperimentError } from '@/background/handlers/experiment-error';
import { handleExperimentToggle } from '@/background/handlers/experiment-toggle';
import { handleFetchPage } from '@/background/handlers/fetch-page';
import { handleLlmComplete } from '@/background/handlers/llm-complete';
import {
  handleLlmClearCache,
  handleLlmResetSession,
  handleProviderTest,
} from '@/background/handlers/provider-test';
import { handleScrapeRenderedPage } from '@/background/handlers/scrape-rendered-page';
import { handleUpdateCheck } from '@/background/handlers/update-check';
import { handleWhoAmI } from '@/background/handlers/who-am-i';
import { registerLlmStreamHandler } from '@/background/llm/stream';
import { onMessage } from '@/shared/messages';
import { runStartupMigration } from '@/shared/storage';

// ===== STARTUP MIGRATION (RESEARCH R7) =====
// MUST run BEFORE the onMessage registrations below — handlers may read/write
// last_error, and the migration consolidates Phase 1's per-key shape into a
// single map. The void+catch ensures the SW never throws at top level.
void runStartupMigration().catch((err: unknown) => {
  console.error('[bg] migration failed', err);
});

// ===== TOP-LEVEL LISTENERS (SP-7) =====
// Registered immediately on SW startup, before any await, before defineBackground.
// @webext-core/messaging onMessage() registers the underlying chrome runtime
// listener synchronously, preserving the Phase 1 invariant (RESEARCH R1).
onMessage('EXPERIMENT_TOGGLE', ({ data }) => handleExperimentToggle(data));
onMessage('TWEAKS_CHANGED', async () => {
  await broadcastStateChanged();
  return { ok: true };
});
onMessage('EXPERIMENT_ERROR', ({ data }) => handleExperimentError(data));
onMessage('LLM_COMPLETE', ({ data }) => handleLlmComplete(data));
onMessage('CHATGPT_POPUP_RUN', (message) => handleChatGptPopupRun(message.data, message.sender));
onMessage('PROVIDER_TEST', ({ data }) => handleProviderTest(data));
onMessage('LLM_CLEAR_CACHE', () => handleLlmClearCache());
onMessage('LLM_RESET_SESSION', () => handleLlmResetSession());
onMessage('FETCH_PAGE', ({ data }) => handleFetchPage(data));
onMessage('SCRAPE_RENDERED_PAGE', ({ data }) => handleScrapeRenderedPage(data));
onMessage('ICON_THEME_CHANGED', ({ data }) => setActionIconTheme(data.theme));
onMessage('APPLIED_COUNT_CHANGED', ({ data }) => setAppliedCountBadge(data.tabId, data.count));
onMessage('UPDATE_CHECK', () => handleUpdateCheck());
registerLlmStreamHandler();
// WHO_AM_I (Blocker 2): handler reads sender.tab.id; throws when called
// outside a tab context (popup / options). The envelope shape from
// @webext-core/messaging exposes `sender` directly.
onMessage('WHO_AM_I', (message) => handleWhoAmI({ sender: message.sender }));
// Note: STATE_CHANGED is broadcast-only (SW → tabs); SW does not handle it.
// Note: STATUS_QUERY is content-script-handled (popup → active content script).

// Cleanup stale applied:<tabId> keys when tabs close (RESEARCH §11).
// chrome.tabs.onRemoved is a top-level event registration (SP-7-compatible).
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(`applied:${tabId}`);
  void setAppliedCountBadge(tabId, 0);
});

// ===== WXT-DEFINED MAIN (kept near-empty per SP-7) =====
export default defineBackground(() => {
  // setAccessLevel grants chrome.storage.session access to content scripts
  // (default = TRUSTED_CONTEXTS, content scripts denied). RESEARCH R6.
  // Idempotent: Chrome treats repeat calls as no-ops if already set.
  void chrome.storage.session
    .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch((err: unknown) => console.error('[bg] setAccessLevel failed', err));
});
