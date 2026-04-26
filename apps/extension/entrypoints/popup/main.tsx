import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/popup.css';
import { mergeTweakValues, type Registry } from '@platform/experiment-sdk';
import { useStore } from '@/popup/store';
import { syncActionIconWithColorScheme } from '@/shared/icon-theme';
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
  tweakErrorsStorageKey,
  tweakValuesStorageKey,
} from '@/shared/storage';
import { App } from './App';

syncActionIconWithColorScheme();

async function bootstrapStore(): Promise<void> {
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.enabled)
      useStore.getState().setEnabled((changes.enabled.newValue as Record<string, boolean>) ?? {});
    if (changes.autodisabled) {
      useStore
        .getState()
        .setAutoDisabled(
          (changes.autodisabled.newValue as ReturnType<typeof useStore.getState>['autodisabled']) ??
            {},
        );
    }
    if (changes.last_error) {
      useStore
        .getState()
        .setLastError(
          (changes.last_error.newValue as ReturnType<typeof useStore.getState>['lastError']) ?? {},
        );
    }
    if (changes['llm:settings']) {
      void getPublicLlmConfig().then((config) => useStore.getState().setPublicLlmConfig(config));
    }
    if (changes['llm:last_error']) {
      void getLastLlmError().then((error) => useStore.getState().setLastLlmError(error));
    }
    const state = useStore.getState();
    let nextTweakValues = state.tweakValues;
    let nextTweakErrors = state.tweakErrors;
    for (const entry of state.registry) {
      const valueChange = changes[tweakValuesStorageKey(entry.id)];
      if (valueChange) {
        nextTweakValues = {
          ...nextTweakValues,
          [entry.id]: mergeTweakValues(
            entry.tweaks,
            (valueChange.newValue as Record<string, unknown>) ?? {},
          ),
        };
      }
      const errorChange = changes[tweakErrorsStorageKey(entry.id)];
      if (errorChange) {
        nextTweakErrors = {
          ...nextTweakErrors,
          [entry.id]:
            (errorChange.newValue as ReturnType<typeof useStore.getState>['tweakErrors'][string]) ??
            [],
        };
      }
    }
    if (nextTweakValues !== state.tweakValues) state.setTweakValues(nextTweakValues);
    if (nextTweakErrors !== state.tweakErrors) state.setTweakErrors(nextTweakErrors);
  }
  if (areaName === 'session') {
    const activeTabId = useStore.getState().activeTabId;
    const appliedChange = activeTabId != null ? changes[`applied:${activeTabId}`] : undefined;
    if (appliedChange) {
      useStore.getState().setAppliedInActiveTab((appliedChange.newValue as string[]) ?? []);
    }
    if (changes['llm:session']) {
      void getLlmSessionStats().then((stats) => useStore.getState().setLlmSession(stats));
    }
  }
});

void bootstrapStore().catch((err: unknown) => {
  console.error('[popup] bootstrap failed', err);
  useStore.getState().setBootstrapped(true);
});

const container = document.getElementById('root');
if (!container) throw new Error('popup: #root missing');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
