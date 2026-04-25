/**
 * Typed wrapper over chrome.storage.local.
 * Per CONTEXT D-12: ZERO module-scope state. Every read returns from storage.
 * The SW survives idle termination (~30s); any caching here would be wiped.
 */

import type { AutoDisableRecord, ErrorRecord } from '@platform/experiment-sdk';

const KEY_ENABLED = 'enabled';
const LAST_ERROR_PREFIX = 'last_error:';

// ===== Phase 2 storage-key constants (D-09, D-12, D-28, D-29) =====

const KEY_AUTODISABLED = 'autodisabled';
const KEY_LAST_ERROR = 'last_error';
const ERR_WINDOW_PREFIX = 'error_window:';
const APPLIED_PREFIX = 'applied:';
const PHASE1_LAST_ERROR_PREFIX = 'last_error:';
const KEY_MIGRATIONS = '_migrations';
const MIGRATION_NAME = 'last_error_to_map_v1';

// ===== Phase 1 helpers (preserved verbatim) =====

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

export async function recordLastError(id: string, message: string): Promise<void> {
  await chrome.storage.local.set({ [`${LAST_ERROR_PREFIX}${id}`]: message });
}

export async function clearLastError(id: string): Promise<void> {
  await chrome.storage.local.remove(`${LAST_ERROR_PREFIX}${id}`);
}

// ===== Phase 2 additions (D-09, D-12, D-28, D-29) =====

// ----- last_error map (D-29 promotion of Phase 1 per-key shape) -----

export async function getLastErrors(): Promise<Record<string, ErrorRecord>> {
  const r = await chrome.storage.local.get(KEY_LAST_ERROR);
  const v = r[KEY_LAST_ERROR];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, ErrorRecord>;
  }
  return {};
}

export async function setLastError(id: string, error: ErrorRecord): Promise<void> {
  const map = await getLastErrors();
  map[id] = error;
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

export async function clearLastErrorMap(id: string): Promise<void> {
  const map = await getLastErrors();
  delete map[id];
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

// ----- autodisabled map (D-12 persistent kill-switch) -----

export async function getAutoDisabled(): Promise<Record<string, AutoDisableRecord>> {
  const r = await chrome.storage.local.get(KEY_AUTODISABLED);
  const v = r[KEY_AUTODISABLED];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, AutoDisableRecord>;
  }
  return {};
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

// ----- error_window:<id> in storage.session (D-09 sliding window) -----

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

// ----- applied:<tabId> in storage.session (D-09 per-tab applied set) -----

export async function getAppliedInTab(tabId: number): Promise<string[]> {
  const key = `${APPLIED_PREFIX}${tabId}`;
  const r = await chrome.storage.session.get(key);
  const v = r[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

export async function setAppliedInTab(tabId: number, ids: string[]): Promise<void> {
  await chrome.storage.session.set({ [`${APPLIED_PREFIX}${tabId}`]: ids });
}

// ----- D-29 idempotent migration -----
// CRITICAL ORDERING (RESEARCH R7): MUST run BEFORE any handler reads/writes
// last_error in Phase 2. background.ts (Plan 02-03) calls runStartupMigration()
// before registering onMessage handlers.

export async function runStartupMigration(): Promise<void> {
  const r = await chrome.storage.local.get(KEY_MIGRATIONS);
  const done = (r[KEY_MIGRATIONS] as string[] | undefined) ?? [];
  if (done.includes(MIGRATION_NAME)) return; // idempotent

  const all = await chrome.storage.local.get(null);
  const oldKeys = Object.keys(all).filter(
    (k) => k.startsWith(PHASE1_LAST_ERROR_PREFIX) && k !== KEY_LAST_ERROR,
  );
  if (oldKeys.length === 0) {
    await chrome.storage.local.set({ [KEY_MIGRATIONS]: [...done, MIGRATION_NAME] });
    return;
  }

  const map: Record<string, ErrorRecord> = {};
  for (const k of oldKeys) {
    const id = k.slice(PHASE1_LAST_ERROR_PREFIX.length);
    const value = all[k];
    // Phase 1 stored String(err); promote to ErrorRecord shape.
    map[id] = {
      phase: 'apply',
      message: typeof value === 'string' ? value : String(value),
      at: Date.now(),
    };
  }
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
  await chrome.storage.local.remove(oldKeys);
  await chrome.storage.local.set({ [KEY_MIGRATIONS]: [...done, MIGRATION_NAME] });
}
