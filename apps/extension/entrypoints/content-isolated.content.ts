import {
  type ApplyFn,
  type CleanupFn,
  type Registry,
  type RegistryEntry,
  TweakValueValidationError,
  validateTweakValues,
} from '@platform/experiment-sdk';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  filterAutoDisabled,
  filterByWorld,
  isAbortError,
  shouldReapplyForTweakValues,
  stableTweakValuesKey,
} from '@/content/engine';
import { createHelperContext } from '@/content/helpers';
import { syncActionIconWithColorScheme } from '@/shared/icon-theme';
import { onMessage, sendMessage } from '@/shared/messages';
import {
  clearLastError,
  clearTweakErrors,
  getAutoDisabled,
  getEnabledExperiments,
  getPublicLlmConfig,
  getTweakValues,
  setAppliedInTab,
  setTweakErrors,
} from '@/shared/storage';
import { matchesScope } from '@/shared/url-match';

type AppliedExperiment = {
  cleanup: CleanupFn;
  controller: AbortController;
  valuesKey: string;
};

const cleanups = new Map<string, AppliedExperiment>();
const lastApplyAt = new Map<string, number>();

function omitUnknownTweakValues(
  entry: RegistryEntry,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = new Set(entry.tweaks.map((tweak) => tweak.key));
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowedKeys.has(key)));
}

export default defineContentScript({
  matches: ['*://*.ya.ru/*', '*://ya.ru/*'],
  runAt: 'document_idle',
  main: () => {
    syncActionIconWithColorScheme();
    void bootstrap();
  },
});

async function bootstrap(): Promise<void> {
  const { tabId } = await sendMessage('WHO_AM_I', undefined);

  await reconcile(tabId);

  onMessage('STATE_CHANGED', ({ data }) => {
    if (data.tabId !== tabId) return;
    void reconcile(tabId);
  });

  onMessage('TWEAKS_CHANGED', ({ data }) => {
    void reconcile(tabId, data.id);
    return { ok: true };
  });
}

async function loadEntries(): Promise<RegistryEntry[]> {
  const registry = await fetch(chrome.runtime.getURL('registry.json')).then(
    (r) => r.json() as Promise<Registry>,
  );
  return filterByWorld(registry, 'isolated');
}

async function reconcile(tabId: number, changedId?: string): Promise<void> {
  const entries = await loadEntries();
  if (changedId && !entries.some((entry) => entry.id === changedId)) {
    const applied = cleanups.get(changedId);
    if (applied) {
      await cleanupApplied(changedId, applied);
      cleanups.delete(changedId);
      await setAppliedInTab(tabId, Array.from(cleanups.keys()));
    }
    return;
  }

  const [enabled, autodisabled] = await Promise.all([getEnabledExperiments(), getAutoDisabled()]);
  const eligibleEntries = filterAutoDisabled(entries, autodisabled);
  const wantOn = eligibleEntries.filter(
    (entry) => enabled[entry.id] && matchesScope(location.href, entry.scope),
  );
  const wantOnIds = new Set(wantOn.map((entry) => entry.id));

  for (const [id, applied] of Array.from(cleanups.entries())) {
    if (!wantOnIds.has(id)) {
      await cleanupApplied(id, applied);
      cleanups.delete(id);
    }
  }

  for (const entry of wantOn) {
    const storedValues = await getTweakValues(entry.id);
    let tweakValues: Record<string, unknown>;
    try {
      tweakValues = validateTweakValues(entry.tweaks, omitUnknownTweakValues(entry, storedValues));
      await clearTweakErrors(entry.id);
    } catch (err) {
      if (err instanceof TweakValueValidationError) {
        const applied = cleanups.get(entry.id);
        if (applied) {
          await cleanupApplied(entry.id, applied);
          cleanups.delete(entry.id);
        }
        await setTweakErrors(entry.id, err.issues);
        continue;
      }
      throw err;
    }
    const valuesKey = stableTweakValuesKey(tweakValues);
    const applied = cleanups.get(entry.id);
    if (!shouldReapplyForTweakValues(applied?.valuesKey, tweakValues)) continue;
    if (!(await canApplyNow(entry.id))) continue;
    if (applied) {
      await cleanupApplied(entry.id, applied);
      cleanups.delete(entry.id);
    }
    await applyEntry(entry, tweakValues, valuesKey);
  }

  await setAppliedInTab(tabId, Array.from(cleanups.keys()));
}

async function canApplyNow(id: string): Promise<boolean> {
  const interval =
    (await getPublicLlmConfig().catch(() => null))?.costGuard.applyRateLimitMs ?? 1000;
  const now = Date.now();
  const last = lastApplyAt.get(id) ?? 0;
  if (now - last < interval) {
    console.debug('[engine] apply rate-limited', id);
    return false;
  }
  lastApplyAt.set(id, now);
  return true;
}

async function cleanupApplied(id: string, applied: AppliedExperiment): Promise<void> {
  try {
    applied.controller.abort();
    await applied.cleanup();
  } catch (err) {
    if (isAbortError(err)) return;
    console.error('[engine] cleanup failed', id, err);
    await reportExperimentError(id, 'cleanup', err);
  }
}

async function applyEntry(
  entry: RegistryEntry,
  tweakValues: Record<string, unknown>,
  valuesKey: string,
): Promise<void> {
  try {
    const mod = (await import(/* @vite-ignore */ chrome.runtime.getURL(entry.chunkPath))) as {
      apply: ApplyFn;
    };
    const controller = new AbortController();
    const helperContext = createHelperContext({
      experimentId: entry.id,
      signal: controller.signal,
    });
    const cleanup = await mod.apply({
      tweaks: tweakValues,
      helpers: helperContext.helpers,
      currentURL: location.href,
      log: (msg, ...rest) => console.debug('[exp]', entry.id, msg, ...rest),
      signal: controller.signal,
    });
    cleanups.set(entry.id, {
      cleanup: async () => {
        await cleanup();
        await helperContext.cleanup();
      },
      controller,
      valuesKey,
    });
    await clearLastError(entry.id);
  } catch (err) {
    console.error('[engine] apply failed', entry.id, err);
    await reportExperimentError(entry.id, 'apply', err);
  }
}

async function reportExperimentError(
  id: string,
  phase: 'apply' | 'cleanup',
  err: unknown,
): Promise<void> {
  const error = err instanceof Error ? err : new Error(String(err));
  await sendMessage('EXPERIMENT_ERROR', {
    id,
    phase,
    message: error.message,
    stack: error.stack,
  }).catch(() => {});
}
