import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/popup.css';
import { mergeTweakValues } from '@platform/experiment-sdk';
import { hydratePopupStore } from '@/popup/registry-refresh';
import { useStore } from '@/popup/store';
import { syncActionIconWithColorScheme } from '@/shared/icon-theme';
import {
  getLastLlmError,
  getLlmSessionStats,
  getPublicLlmConfig,
  tweakErrorsStorageKey,
  tweakValuesStorageKey,
} from '@/shared/storage';
import { App } from './App';

syncActionIconWithColorScheme();

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

void hydratePopupStore().catch((err: unknown) => {
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
