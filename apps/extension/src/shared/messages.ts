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
import type {
  ErrorRecord,
  ExperimentStatus,
  FetchPageResult,
  LlmOptions,
  LlmProvider,
  LlmResult,
} from '@platform/experiment-sdk';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { UpdateState } from './storage';

export type ToggleResult = { ok: true } | { ok: false; error: string };

export type ErrorReport = {
  id: string;
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
};

export type WhoAmIResult = { tabId: number };

export type LlmCompleteRequest = {
  experimentId: string;
  prompt: string;
  options?: LlmOptions;
};

export type ProviderTestResult = { ok: true } | { ok: false; error: string };
export type IconTheme = 'light' | 'dark';
export type UpdateCheckResult =
  | { ok: true; state: UpdateState }
  | { ok: false; error: string; state?: UpdateState | null };

export interface ProtocolMap {
  EXPERIMENT_TOGGLE(data: { id: string; enabled: boolean }): ToggleResult;
  TWEAKS_CHANGED(data: { id: string }): ToggleResult;
  STATE_CHANGED(data: { tabId: number }): void;
  APPLIED_COUNT_CHANGED(data: { tabId: number; count: number }): { ok: true };
  EXPERIMENT_ERROR(data: ErrorReport): { ok: true };
  STATUS_QUERY(): Record<string, ExperimentStatus>;
  WHO_AM_I(): WhoAmIResult;
  LLM_COMPLETE(data: LlmCompleteRequest): LlmResult;
  PROVIDER_TEST(data: { provider: LlmProvider }): ProviderTestResult;
  LLM_CLEAR_CACHE(): { ok: true };
  LLM_RESET_SESSION(): { ok: true };
  FETCH_PAGE(data: { url: string; selector?: string }): FetchPageResult;
  ICON_THEME_CHANGED(data: { theme: IconTheme }): { ok: true };
  UPDATE_CHECK(): UpdateCheckResult;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();

// Re-export ErrorRecord so consumers don't need to dual-import from the SDK.
export type { ErrorRecord };
