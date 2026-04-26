import type { LlmProvider } from '@platform/experiment-sdk';
import {
  clearLastLlmError,
  clearLlmCache,
  clearProviderKey,
  getLastLlmError,
  getLlmSessionStats,
  getLlmSettings,
  type LastLlmError,
  type LlmSessionStats,
  type LlmSettings,
  resetLlmSessionStats,
  setLlmDefaults,
  setProviderKey,
} from '@/shared/storage';

export type OptionsState = {
  settings: LlmSettings;
  session: LlmSessionStats;
  lastError?: LastLlmError;
};

export async function loadOptionsState(): Promise<OptionsState> {
  const [settings, session, lastError] = await Promise.all([
    getLlmSettings(),
    getLlmSessionStats(),
    getLastLlmError(),
  ]);
  return { settings, session, lastError };
}

export async function saveProviderKey(provider: LlmProvider, key: string): Promise<OptionsState> {
  await setProviderKey(provider, key);
  return loadOptionsState();
}

export async function clearOptionsProviderKey(provider: LlmProvider): Promise<OptionsState> {
  await clearProviderKey(provider);
  return loadOptionsState();
}

export async function saveLlmDefaults(
  defaults: Parameters<typeof setLlmDefaults>[0],
): Promise<OptionsState> {
  await setLlmDefaults(defaults);
  return loadOptionsState();
}

export async function clearOptionsLlmCache(): Promise<OptionsState> {
  await clearLlmCache();
  return loadOptionsState();
}

export async function resetOptionsSession(): Promise<OptionsState> {
  await resetLlmSessionStats();
  return loadOptionsState();
}

export async function clearOptionsLastError(): Promise<OptionsState> {
  await clearLastLlmError();
  return loadOptionsState();
}
