import { mergeTweakValues, type Registry } from '@platform/experiment-sdk';
import { useStore } from '@/popup/store';
import {
  getAppliedInTab,
  getAutoDisabled,
  getEnabledExperiments,
  getLastErrors,
  getLastLlmError,
  getLlmSessionStats,
  getPublicLlmConfig,
  getTweakErrors,
  getTweakValues,
} from '@/shared/storage';

export async function hydratePopupStore(): Promise<void> {
  const registry = (await fetch(chrome.runtime.getURL('registry.json')).then((r) =>
    r.json(),
  )) as Registry;
  const [
    enabled,
    autodisabled,
    lastError,
    publicLlmConfig,
    lastLlmError,
    llmSession,
    tabs,
    tweakValuesEntries,
    tweakErrorEntries,
  ] = await Promise.all([
    getEnabledExperiments(),
    getAutoDisabled(),
    getLastErrors(),
    getPublicLlmConfig(),
    getLastLlmError(),
    getLlmSessionStats(),
    chrome.tabs.query({ active: true, currentWindow: true }),
    Promise.all(
      registry.map(
        async (entry) =>
          [entry.id, mergeTweakValues(entry.tweaks, await getTweakValues(entry.id))] as const,
      ),
    ),
    Promise.all(registry.map(async (entry) => [entry.id, await getTweakErrors(entry.id)] as const)),
  ]);
  const activeTab = tabs[0];
  const activeTabId = activeTab?.id ?? null;
  const appliedInActiveTab = activeTabId != null ? await getAppliedInTab(activeTabId) : [];

  useStore.setState({
    registry,
    enabled,
    autodisabled,
    lastError,
    publicLlmConfig,
    lastLlmError,
    llmSession,
    tweakValues: Object.fromEntries(tweakValuesEntries),
    tweakErrors: Object.fromEntries(tweakErrorEntries),
    activeTabId,
    activeTabUrl: activeTab?.url ?? null,
    appliedInActiveTab,
    bootstrapped: true,
  });
}
