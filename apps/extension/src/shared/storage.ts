/**
 * Typed wrapper over chrome.storage.{local,session}.
 * Per CONTEXT D-12 / SP-1: ZERO module-scope state. Every read returns from storage.
 * The SW survives idle termination (~30s); any caching here would be wiped.
 *
 * Phase 2 additions (D-09, D-12, D-28, D-29; RESEARCH §7 verbatim):
 *  - `last_error` map (promotes Phase 1's per-key shape — D-29 idempotent migration)
 *  - `autodisabled` map (engine kill-switch in storage.local — persistent)
 *  - `error_window:<id>` in storage.session (sliding window counter)
 *  - `applied:<tabId>` in storage.session (per-tab applied set)
 *  - `runStartupMigration()` for Phase 1 → Phase 2 last_error consolidation
 */

import type { AutoDisableRecord, ErrorRecord } from '@platform/experiment-sdk';

// ===== Storage key constants (no string literals scattered through helpers) =====

const KEY_ENABLED = 'enabled';
const KEY_AUTODISABLED = 'autodisabled';
const KEY_LAST_ERROR = 'last_error';
const ERR_WINDOW_PREFIX = 'error_window:';
const APPLIED_PREFIX = 'applied:';
const PHASE1_LAST_ERROR_PREFIX = 'last_error:';
const LAST_ERROR_PREFIX = 'last_error:'; // Phase 1 alias (kept for back-compat)

// ===== Phase 1 helpers (unchanged) =====

export async function getEnabledExperiments(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(KEY_ENABLED);
  const value = result[KEY_ENABLED];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, boolean>;
  }
  return {};
}

export async function setEnabledExperiment(id: string, enabled: boolean): Promise<void> {
  const current = await getEnabledExperiments();
  await chrome.storage.local.set({
    [KEY_ENABLED]: { ...current, [id]: enabled },
  });
}

/**
 * Phase 1 helper retained as a deprecated forwarder onto the Phase 2 map shape.
 * Writes a minimal ErrorRecord under `last_error[id]` so Phase 2 readers see it.
 */
export async function recordLastError(id: string, message: string): Promise<void> {
  await setLastError(id, {
    phase: 'apply',
    message,
    at: Date.now(),
  });
}

/**
 * Phase 1 helper retained for callers that only know "clear by id".
 */
export async function clearLastError(id: string): Promise<void> {
  const map = await getLastErrors();
  delete map[id];
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

// ===== Phase 2 — last_error map =====

export async function getLastErrors(): Promise<Record<string, ErrorRecord>> {
  const r = await chrome.storage.local.get(KEY_LAST_ERROR);
  return (r[KEY_LAST_ERROR] as Record<string, ErrorRecord> | undefined) ?? {};
}

export async function setLastError(id: string, error: ErrorRecord): Promise<void> {
  const map = await getLastErrors();
  map[id] = error;
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

// ===== Phase 2 — autodisabled map =====

export async function getAutoDisabled(): Promise<Record<string, AutoDisableRecord>> {
  const r = await chrome.storage.local.get(KEY_AUTODISABLED);
  return (r[KEY_AUTODISABLED] as Record<string, AutoDisableRecord> | undefined) ?? {};
}

export async function setAutoDisable(id: string, record: AutoDisableRecord): Promise<void> {
  const map = await getAutoDisabled();
  map[id] = record;
  await chrome.storage.local.set({ [KEY_AUTODISABLED]: map });
}

export async function clearAutoDisable(id: string): Promise<void> {
  const map = await getAutoDisabled();
  delete map[id];
  await chrome.storage.local.set({ [KEY_AUTODISABLED]: map });
}

// ===== Phase 2 — error_window:<id> in storage.session (sliding window) =====

export type ErrorWindow = { count: number; firstAt: number };

export async function getErrorWindow(id: string): Promise<ErrorWindow | undefined> {
  const key = `${ERR_WINDOW_PREFIX}${id}`;
  const r = await chrome.storage.session.get(key);
  return r[key] as ErrorWindow | undefined;
}

export async function setErrorWindow(id: string, w: ErrorWindow): Promise<void> {
  await chrome.storage.session.set({ [`${ERR_WINDOW_PREFIX}${id}`]: w });
}

export async function clearErrorWindow(id: string): Promise<void> {
  await chrome.storage.session.remove(`${ERR_WINDOW_PREFIX}${id}`);
}

// ===== Phase 2 — applied:<tabId> in storage.session =====

export async function getAppliedInTab(tabId: number): Promise<string[]> {
  const key = `${APPLIED_PREFIX}${tabId}`;
  const r = await chrome.storage.session.get(key);
  return (r[key] as string[] | undefined) ?? [];
}

export async function setAppliedInTab(tabId: number, ids: string[]): Promise<void> {
  await chrome.storage.session.set({ [`${APPLIED_PREFIX}${tabId}`]: ids });
}

// ===== Phase 2 — D-29 idempotent startup migration =====
//
// Promotes Phase 1's `last_error:<id>` per-key shape into the consolidated
// `last_error` map. Idempotency record lives in `_migrations` array under
// `chrome.storage.local`. Multiple SW wake-ups are safe (R7).

const MIGRATION_KEY = '_migrations';
const MIGRATION_NAME = 'last_error_to_map_v1';

export async function runStartupMigration(): Promise<void> {
  const r = await chrome.storage.local.get(MIGRATION_KEY);
  const done = (r[MIGRATION_KEY] as string[] | undefined) ?? [];
  if (done.includes(MIGRATION_NAME)) return; // idempotent

  // Find all `last_error:<ulid>` keys.
  const all = await chrome.storage.local.get(null);
  const oldKeys = Object.keys(all).filter((k) => k.startsWith(PHASE1_LAST_ERROR_PREFIX));
  if (oldKeys.length === 0) {
    // Nothing to migrate; still mark done so we don't scan again.
    await chrome.storage.local.set({ [MIGRATION_KEY]: [...done, MIGRATION_NAME] });
    return;
  }

  const map: Record<string, ErrorRecord> = {};
  for (const k of oldKeys) {
    const id = k.slice(PHASE1_LAST_ERROR_PREFIX.length);
    const value = all[k];
    map[id] = {
      phase: 'apply',
      message: typeof value === 'string' ? value : String(value),
      at: Date.now(),
    };
  }
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
  await chrome.storage.local.remove(oldKeys);
  await chrome.storage.local.set({ [MIGRATION_KEY]: [...done, MIGRATION_NAME] });
}

// Re-export prefix for any callers needing the literal (Phase 1 compat).
export { LAST_ERROR_PREFIX };
