/**
 * Typed wrapper over chrome.storage.local.
 * Per CONTEXT D-12: ZERO module-scope state. Every read returns from storage.
 * The SW survives idle termination (~30s); any caching here would be wiped.
 */

const KEY_ENABLED = 'enabled';
const LAST_ERROR_PREFIX = 'last_error:';

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
