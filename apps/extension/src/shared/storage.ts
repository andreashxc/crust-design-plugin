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

import type {
  AutoDisableRecord,
  ErrorRecord,
  LlmProvider,
  LlmUsage,
  TweakValidationError,
} from '@platform/experiment-sdk';

// ===== Storage key constants (no string literals scattered through helpers) =====

const KEY_ENABLED = 'enabled';
const KEY_AUTODISABLED = 'autodisabled';
const KEY_LAST_ERROR = 'last_error';
const KEY_LLM_SETTINGS = 'llm:settings';
const KEY_LLM_LAST_ERROR = 'llm:last_error';
const KEY_LLM_SESSION = 'llm:session';
const KEY_EXPERIMENT_ORDER = 'experiment_order';
const KEY_AUTHOR_GROUP_OPEN = 'popup:author_group_open';
const KEY_UPDATE_STATE = 'update:state';
const TWEAKS_PREFIX = 'tweaks:';
const TWEAK_ERRORS_PREFIX = 'tweak_errors:';
const ERR_WINDOW_PREFIX = 'error_window:';
const APPLIED_PREFIX = 'applied:';
const LLM_CACHE_PREFIX = 'llm:cache:';
const PHASE1_LAST_ERROR_PREFIX = 'last_error:';
const LAST_ERROR_PREFIX = 'last_error:'; // Phase 1 alias (kept for back-compat)

export type LlmCostGuardSettings = {
  cacheEnabled: boolean;
  cacheTtlMs: number;
  maxAttempts: number;
  maxOutputTokens: number;
  warningCallsPerSession: number;
  applyRateLimitMs: number;
};

export type LlmSettings = {
  providerKeys: Partial<Record<LlmProvider, string>>;
  defaultProvider: LlmProvider;
  models: Record<LlmProvider, string>;
  costGuard: LlmCostGuardSettings;
};

export type PublicLlmConfig = Omit<LlmSettings, 'providerKeys'> & {
  providers: Record<LlmProvider, { configured: boolean }>;
};

export type LlmCacheEntry = {
  text: string;
  provider: LlmProvider;
  model: string;
  cachedAt: number;
  expiresAt: number;
  usage?: LlmUsage;
};

export type LlmSessionStats = {
  calls: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  startedAt: number;
  updatedAt: number;
};

export type UpdateState = {
  currentVersion: string;
  currentCommit?: string;
  remoteVersion?: string;
  remoteCommit?: string;
  available: boolean;
  checkedAt: number;
  url?: string;
  error?: string;
};

export type LastLlmError = {
  experimentId?: string;
  provider?: LlmProvider;
  message: string;
  code?: string;
  at: number;
};

export type LlmCacheKeyInput = {
  provider: LlmProvider;
  model: string;
  prompt: string;
  maxOutputTokens: number;
  cacheKey?: string;
};

const DEFAULT_LLM_COST_GUARD: LlmCostGuardSettings = {
  cacheEnabled: true,
  cacheTtlMs: 10 * 60 * 1000,
  maxAttempts: 3,
  maxOutputTokens: 512,
  warningCallsPerSession: 10,
  applyRateLimitMs: 1000,
};

const DEFAULT_LLM_SETTINGS: LlmSettings = {
  providerKeys: {},
  defaultProvider: 'openai',
  models: {
    openai: 'gpt-5',
    anthropic: 'claude-sonnet-4-5',
  },
  costGuard: DEFAULT_LLM_COST_GUARD,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isProvider(value: unknown): value is LlmProvider {
  return value === 'openai' || value === 'anthropic';
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function sanitizeLlmSettings(value: unknown): LlmSettings {
  if (!isRecord(value)) return structuredClone(DEFAULT_LLM_SETTINGS);

  const providerKeysRaw = isRecord(value.providerKeys) ? value.providerKeys : {};
  const providerKeys: Partial<Record<LlmProvider, string>> = {};
  for (const provider of ['openai', 'anthropic'] as const) {
    if (typeof providerKeysRaw[provider] === 'string' && providerKeysRaw[provider].length > 0) {
      providerKeys[provider] = providerKeysRaw[provider];
    }
  }

  const modelsRaw = isRecord(value.models) ? value.models : {};
  const costGuardRaw = isRecord(value.costGuard) ? value.costGuard : {};

  return {
    providerKeys,
    defaultProvider: isProvider(value.defaultProvider)
      ? value.defaultProvider
      : DEFAULT_LLM_SETTINGS.defaultProvider,
    models: {
      openai: stringOrDefault(modelsRaw.openai, DEFAULT_LLM_SETTINGS.models.openai),
      anthropic: stringOrDefault(modelsRaw.anthropic, DEFAULT_LLM_SETTINGS.models.anthropic),
    },
    costGuard: {
      cacheEnabled:
        typeof costGuardRaw.cacheEnabled === 'boolean'
          ? costGuardRaw.cacheEnabled
          : DEFAULT_LLM_COST_GUARD.cacheEnabled,
      cacheTtlMs: numberOrDefault(costGuardRaw.cacheTtlMs, DEFAULT_LLM_COST_GUARD.cacheTtlMs),
      maxAttempts: Math.max(
        1,
        numberOrDefault(costGuardRaw.maxAttempts, DEFAULT_LLM_COST_GUARD.maxAttempts),
      ),
      maxOutputTokens: Math.max(
        1,
        numberOrDefault(costGuardRaw.maxOutputTokens, DEFAULT_LLM_COST_GUARD.maxOutputTokens),
      ),
      warningCallsPerSession: Math.max(
        1,
        numberOrDefault(
          costGuardRaw.warningCallsPerSession,
          DEFAULT_LLM_COST_GUARD.warningCallsPerSession,
        ),
      ),
      applyRateLimitMs: numberOrDefault(
        costGuardRaw.applyRateLimitMs,
        DEFAULT_LLM_COST_GUARD.applyRateLimitMs,
      ),
    },
  };
}

function sessionStatsNow(): LlmSessionStats {
  const now = Date.now();
  return {
    calls: 0,
    cacheHits: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    startedAt: now,
    updatedAt: now,
  };
}

function sanitizeSessionStats(value: unknown): LlmSessionStats {
  const defaults = sessionStatsNow();
  if (!isRecord(value)) return defaults;
  return {
    calls: numberOrDefault(value.calls, defaults.calls),
    cacheHits: numberOrDefault(value.cacheHits, defaults.cacheHits),
    inputTokens: numberOrDefault(value.inputTokens, defaults.inputTokens),
    outputTokens: numberOrDefault(value.outputTokens, defaults.outputTokens),
    totalTokens: numberOrDefault(value.totalTokens, defaults.totalTokens),
    startedAt: numberOrDefault(value.startedAt, defaults.startedAt),
    updatedAt: numberOrDefault(value.updatedAt, defaults.updatedAt),
  };
}

function sanitizeUpdateState(value: unknown): UpdateState | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.currentVersion !== 'string' ||
    typeof value.available !== 'boolean' ||
    typeof value.checkedAt !== 'number'
  ) {
    return null;
  }
  return {
    currentVersion: value.currentVersion,
    currentCommit: typeof value.currentCommit === 'string' ? value.currentCommit : undefined,
    remoteVersion: typeof value.remoteVersion === 'string' ? value.remoteVersion : undefined,
    remoteCommit: typeof value.remoteCommit === 'string' ? value.remoteCommit : undefined,
    available: value.available,
    checkedAt: value.checkedAt,
    url: typeof value.url === 'string' ? value.url : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
  };
}

// ===== Phase 1 helpers (unchanged) =====

export async function getEnabledExperiments(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(KEY_ENABLED);
  const value = result[KEY_ENABLED];
  if (isRecord(value)) {
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

// ===== Phase 5 — global experiment apply order =====

export async function getExperimentOrder(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEY_EXPERIMENT_ORDER);
  const value = result[KEY_EXPERIMENT_ORDER];
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function setExperimentOrder(ids: string[]): Promise<void> {
  await chrome.storage.local.set({ [KEY_EXPERIMENT_ORDER]: uniqueStrings(ids) });
}

export async function appendExperimentOrder(id: string): Promise<void> {
  const current = await getExperimentOrder();
  if (current.includes(id)) return;
  await setExperimentOrder([...current, id]);
}

// ===== Popup UI state — author group expansion =====

export async function getAuthorGroupOpenState(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(KEY_AUTHOR_GROUP_OPEN);
  const value = result[KEY_AUTHOR_GROUP_OPEN];
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => {
      const [author, open] = entry;
      return author.length > 0 && typeof open === 'boolean';
    }),
  );
}

export async function setAuthorGroupOpenState(state: Record<string, boolean>): Promise<void> {
  const sanitized = Object.fromEntries(
    Object.entries(state).filter((entry): entry is [string, boolean] => {
      const [author, open] = entry;
      return author.length > 0 && typeof open === 'boolean';
    }),
  );
  await chrome.storage.local.set({ [KEY_AUTHOR_GROUP_OPEN]: sanitized });
}

// ===== Phase 5 — sideload update check cache =====

export async function getUpdateState(): Promise<UpdateState | null> {
  const result = await chrome.storage.local.get(KEY_UPDATE_STATE);
  return sanitizeUpdateState(result[KEY_UPDATE_STATE]);
}

export async function setUpdateState(state: UpdateState): Promise<void> {
  await chrome.storage.local.set({ [KEY_UPDATE_STATE]: state });
}

export function sortRegistryByOrder<TEntry extends { id: string }>(
  entries: TEntry[],
  order: string[],
): TEntry[] {
  const orderIndex = new Map(order.map((id, index) => [id, index]));
  return entries
    .map((entry, index) => ({ entry, index, order: orderIndex.get(entry.id) }))
    .sort((left, right) => {
      if (left.order != null && right.order != null) return left.order - right.order;
      if (left.order != null) return -1;
      if (right.order != null) return 1;
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value) => typeof value === 'string' && value.length > 0)),
  );
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

// ===== Phase 3 — tweaks:<id> values in storage.local =====

export async function getTweakValues(id: string): Promise<Record<string, unknown>> {
  const key = tweakValuesStorageKey(id);
  const r = await chrome.storage.local.get(key);
  const value = r[key];
  return isRecord(value) ? value : {};
}

export async function setTweakValues(id: string, values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set({ [tweakValuesStorageKey(id)]: values });
}

export async function clearTweakValues(id: string): Promise<void> {
  await chrome.storage.local.remove(tweakValuesStorageKey(id));
}

// ===== Phase 3 — tweak_errors:<id> validation errors in storage.local =====

export async function getTweakErrors(id: string): Promise<TweakValidationError[]> {
  const key = tweakErrorsStorageKey(id);
  const r = await chrome.storage.local.get(key);
  const value = r[key];
  return Array.isArray(value) ? (value as TweakValidationError[]) : [];
}

export async function setTweakErrors(id: string, errors: TweakValidationError[]): Promise<void> {
  await chrome.storage.local.set({ [tweakErrorsStorageKey(id)]: errors });
}

export async function clearTweakErrors(id: string): Promise<void> {
  await chrome.storage.local.remove(tweakErrorsStorageKey(id));
}

export function tweakValuesStorageKey(id: string): string {
  return `${TWEAKS_PREFIX}${id}`;
}

export function tweakErrorsStorageKey(id: string): string {
  return `${TWEAK_ERRORS_PREFIX}${id}`;
}

// ===== Phase 4 — LLM settings, cache, session counters, diagnostics =====

export function defaultLlmSettings(): LlmSettings {
  return structuredClone(DEFAULT_LLM_SETTINGS);
}

export async function getLlmSettings(): Promise<LlmSettings> {
  const result = await chrome.storage.local.get(KEY_LLM_SETTINGS);
  return sanitizeLlmSettings(result[KEY_LLM_SETTINGS]);
}

export async function setProviderKey(provider: LlmProvider, key: string): Promise<void> {
  const settings = await getLlmSettings();
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    delete settings.providerKeys[provider];
  } else {
    settings.providerKeys[provider] = trimmed;
  }
  await chrome.storage.local.set({ [KEY_LLM_SETTINGS]: settings });
}

export async function clearProviderKey(provider: LlmProvider): Promise<void> {
  const settings = await getLlmSettings();
  delete settings.providerKeys[provider];
  await chrome.storage.local.set({ [KEY_LLM_SETTINGS]: settings });
}

export async function setLlmDefaults(
  defaults: Partial<
    Pick<LlmSettings, 'defaultProvider' | 'models'> & { costGuard: Partial<LlmCostGuardSettings> }
  >,
): Promise<void> {
  const settings = await getLlmSettings();
  const next: LlmSettings = {
    ...settings,
    defaultProvider: defaults.defaultProvider ?? settings.defaultProvider,
    models: {
      ...settings.models,
      ...(defaults.models ?? {}),
    },
    costGuard: {
      ...settings.costGuard,
      ...(defaults.costGuard ?? {}),
    },
  };
  await chrome.storage.local.set({ [KEY_LLM_SETTINGS]: sanitizeLlmSettings(next) });
}

export async function getPublicLlmConfig(): Promise<PublicLlmConfig> {
  const settings = await getLlmSettings();
  return {
    defaultProvider: settings.defaultProvider,
    models: settings.models,
    costGuard: settings.costGuard,
    providers: {
      openai: { configured: Boolean(settings.providerKeys.openai) },
      anthropic: { configured: Boolean(settings.providerKeys.anthropic) },
    },
  };
}

export function llmCacheStorageKey(hash: string): string {
  return `${LLM_CACHE_PREFIX}${hash}`;
}

export function buildLlmCacheKey(input: LlmCacheKeyInput): string {
  const normalized = JSON.stringify({
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens,
    cacheKey: input.cacheKey ?? '',
  });
  return fnv1a32(normalized);
}

export async function getLlmCache(hash: string): Promise<LlmCacheEntry | undefined> {
  const key = llmCacheStorageKey(hash);
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  if (!isRecord(value)) return undefined;
  if (!isProvider(value.provider)) return undefined;
  if (
    typeof value.text !== 'string' ||
    typeof value.model !== 'string' ||
    typeof value.cachedAt !== 'number' ||
    typeof value.expiresAt !== 'number'
  ) {
    return undefined;
  }
  if (value.expiresAt <= Date.now()) {
    await chrome.storage.local.remove(key);
    return undefined;
  }
  return {
    text: value.text,
    provider: value.provider,
    model: value.model,
    cachedAt: value.cachedAt,
    expiresAt: value.expiresAt,
    usage: isRecord(value.usage)
      ? {
          inputTokens:
            typeof value.usage.inputTokens === 'number' ? value.usage.inputTokens : undefined,
          outputTokens:
            typeof value.usage.outputTokens === 'number' ? value.usage.outputTokens : undefined,
          totalTokens:
            typeof value.usage.totalTokens === 'number' ? value.usage.totalTokens : undefined,
        }
      : undefined,
  };
}

export async function setLlmCache(hash: string, value: LlmCacheEntry): Promise<void> {
  await chrome.storage.local.set({ [llmCacheStorageKey(hash)]: value });
}

export async function clearLlmCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith(LLM_CACHE_PREFIX));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
}

export async function getLlmSessionStats(): Promise<LlmSessionStats> {
  const result = await chrome.storage.session.get(KEY_LLM_SESSION);
  return sanitizeSessionStats(result[KEY_LLM_SESSION]);
}

export async function incrementLlmSessionStats(
  delta: Partial<
    Pick<LlmSessionStats, 'calls' | 'cacheHits' | 'inputTokens' | 'outputTokens' | 'totalTokens'>
  >,
): Promise<LlmSessionStats> {
  const current = await getLlmSessionStats();
  const next: LlmSessionStats = {
    ...current,
    calls: current.calls + (delta.calls ?? 0),
    cacheHits: current.cacheHits + (delta.cacheHits ?? 0),
    inputTokens: current.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: current.outputTokens + (delta.outputTokens ?? 0),
    totalTokens: current.totalTokens + (delta.totalTokens ?? 0),
    updatedAt: Date.now(),
  };
  await chrome.storage.session.set({ [KEY_LLM_SESSION]: next });
  return next;
}

export async function resetLlmSessionStats(): Promise<LlmSessionStats> {
  const next = sessionStatsNow();
  await chrome.storage.session.set({ [KEY_LLM_SESSION]: next });
  return next;
}

export async function getLastLlmError(): Promise<LastLlmError | undefined> {
  const result = await chrome.storage.local.get(KEY_LLM_LAST_ERROR);
  const value = result[KEY_LLM_LAST_ERROR];
  if (!isRecord(value) || typeof value.message !== 'string' || typeof value.at !== 'number') {
    return undefined;
  }
  return {
    experimentId: typeof value.experimentId === 'string' ? value.experimentId : undefined,
    provider: isProvider(value.provider) ? value.provider : undefined,
    message: value.message,
    code: typeof value.code === 'string' ? value.code : undefined,
    at: value.at,
  };
}

export async function setLastLlmError(error: LastLlmError): Promise<void> {
  await chrome.storage.local.set({ [KEY_LLM_LAST_ERROR]: error });
}

export async function clearLastLlmError(): Promise<void> {
  await chrome.storage.local.remove(KEY_LLM_LAST_ERROR);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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
// Phase 2 explicit alias — same semantics as `clearLastError` (which now operates on the map).
export { clearLastError as clearLastErrorMap, LAST_ERROR_PREFIX };
