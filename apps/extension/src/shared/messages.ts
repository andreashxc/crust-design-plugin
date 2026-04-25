/**
 * Typed message contract between popup, background SW, and content scripts.
 *
 * Phase 2 (D-04): replaces the Phase 1 hand-rolled tag union with
 * @webext-core/messaging's defineExtensionMessaging<ProtocolMap>(). The
 * library is by the WXT author (@aklinker1) and registers the underlying
 * chrome.runtime.onMessage.addListener synchronously at module-import time,
 * preserving SP-7 (Pitfall 1).
 *
 * STATE_CHANGED's payload is enriched with {tabId} (RESEARCH R8) so content
 * scripts can cache their own tab id (no Chrome API for "my tab id").
 * This is a refinement of D-05 within Claude's Discretion: the broadcast
 * mechanism is unchanged; only the payload includes the tab id the SW
 * already iterates.
 *
 * WHO_AM_I (Blocker 2 fix; checker iteration 1): content scripts call this
 * during bootstrap to fetch their own tab id BEFORE the first reconcile.
 * Without it, applied:<tabId> would only be written after the first
 * STATE_CHANGED broadcast — which means the popup status badge would never
 * show "Applied" on initial page load. Handler implementation in
 * src/background/handlers/who-am-i.ts reads sender.tab?.id and throws when
 * called outside a tab context.
 */
import type { ErrorRecord, ExperimentStatus } from '@platform/experiment-sdk';
import { defineExtensionMessaging } from '@webext-core/messaging';

export type ToggleResult = { ok: true } | { ok: false; error: string };

export type ErrorReport = {
  id: string;
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
};

export type WhoAmIResult = { tabId: number };

export interface ProtocolMap {
  EXPERIMENT_TOGGLE(data: { id: string; enabled: boolean }): ToggleResult;
  STATE_CHANGED(data: { tabId: number }): void;
  EXPERIMENT_ERROR(data: ErrorReport): { ok: true };
  STATUS_QUERY(): Record<string, ExperimentStatus>;
  WHO_AM_I(): WhoAmIResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

// Re-export ErrorRecord so consumers don't need to dual-import from the SDK.
export type { ErrorRecord };
