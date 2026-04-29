import {
  type ApplyFn,
  type CleanupFn,
  type Registry,
  type RegistryEntry,
  TweakValueValidationError,
  validateTweakValues,
} from '@platform/experiment-sdk';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startDevRegistryRefresh } from '@/content/dev-refresh';
import { createDomChangeScheduler } from '@/content/dom-observer';
import {
  createReconcileScheduler,
  filterAutoDisabled,
  filterByWorld,
  isAbortError,
  moduleKeyForEntry,
  shouldReapplyExperiment,
  stableTweakValuesKey,
} from '@/content/engine';
import { createHelperContext } from '@/content/helpers';
import { createUrlChangeWatcher } from '@/content/url-change';
import { syncActionIconWithColorScheme } from '@/shared/icon-theme';
import { onMessage, sendMessage } from '@/shared/messages';
import {
  clearLastError,
  clearTweakErrors,
  getAutoDisabled,
  getEnabledExperiments,
  getExperimentOrder,
  getPublicLlmConfig,
  getTweakValues,
  setAppliedInTab,
  setTweakErrors,
  sortRegistryByOrder,
} from '@/shared/storage';
import { matchesScope } from '@/shared/url-match';

type AppliedExperiment = {
  cleanup: CleanupFn;
  controller: AbortController;
  valuesKey: string;
  moduleKey: string;
};

const HEADER_NAV_SWAP_AUTHOR = 'andrew';
const HEADER_NAV_SWAP_FOLDER = 'ya-header-nav-swap';
const HEADER_NAV_SWAP_ORIGINAL_ATTR = 'data-crust-ya-header-nav-swap-original-order';
let headerNavSwapEarlyCleanup: (() => void) | undefined;

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
  runAt: 'document_start',
  main: () => {
    ensureHeaderNavSwapEarlyGuard();
    syncActionIconWithColorScheme();
    void bootstrap().catch((err) => {
      if (isExtensionContextInvalidatedError(err)) return;
      console.error('[engine] bootstrap failed', err);
    });
  },
});

async function bootstrap(): Promise<void> {
  const { tabId } = await sendMessage('WHO_AM_I', undefined);
  const scheduler = createReconcileScheduler(() => reconcile(tabId), {
    onError: (err) => {
      if (isExtensionContextInvalidatedError(err)) return;
      console.error('[engine] reconcile failed', err);
    },
  });

  await scheduler.runNow();

  onMessage('STATE_CHANGED', ({ data }) => {
    if (data.tabId !== tabId) return;
    scheduler.schedule();
  });

  onMessage('TWEAKS_CHANGED', () => {
    scheduler.schedule();
    return { ok: true };
  });

  createUrlChangeWatcher(() => scheduler.schedule());
  createDomChangeScheduler(() => scheduler.schedule());
  startDevRegistryRefresh({
    enabled: import.meta.env.DEV,
    loadEntries,
    getEnabledExperiments,
    getCurrentUrl: () => location.href,
    schedule: scheduler.schedule,
  });
}

async function loadEntries(): Promise<RegistryEntry[]> {
  const registry = await fetch(chrome.runtime.getURL('registry.json')).then(
    (r) => r.json() as Promise<Registry>,
  );
  return filterByWorld(registry, 'isolated');
}

async function reconcile(tabId: number): Promise<void> {
  const entries = await loadEntries();
  const [enabled, autodisabled, order] = await Promise.all([
    getEnabledExperiments(),
    getAutoDisabled(),
    getExperimentOrder(),
  ]);
  const eligibleEntries = filterAutoDisabled(entries, autodisabled);
  const wantOn = sortRegistryByOrder(
    eligibleEntries.filter(
      (entry) => enabled[entry.id] && matchesScope(location.href, entry.scope),
    ),
    order,
  );
  syncHeaderNavSwapEarlyGuard(wantOn);
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
    const moduleKey = moduleKeyForEntry(entry);
    const applied = cleanups.get(entry.id);
    if (
      !shouldReapplyExperiment({
        appliedValuesKey: applied?.valuesKey,
        nextValues: tweakValues,
        appliedModuleKey: applied?.moduleKey,
        nextModuleKey: moduleKey,
      })
    ) {
      continue;
    }
    if (!(await canApplyNow(entry.id))) continue;
    if (applied) {
      await cleanupApplied(entry.id, applied);
      cleanups.delete(entry.id);
    }
    await applyEntry(entry, tweakValues, valuesKey, moduleKey);
  }

  const appliedIds = Array.from(cleanups.keys());
  await setAppliedInTab(tabId, appliedIds);
  await sendMessage('APPLIED_COUNT_CHANGED', { tabId, count: appliedIds.length }).catch(() => {});
}

function ensureHeaderNavSwapEarlyGuard(): void {
  if (!isHeaderNavSwapTargetPage(location.href)) return;
  if (headerNavSwapEarlyCleanup) {
    applyHeaderNavSwapEarlyOrder();
    return;
  }

  const schedule = () => queueMicrotask(applyHeaderNavSwapEarlyOrder);
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const removeUrlListener = createUrlChangeWatcher(() => {
    if (isHeaderNavSwapTargetPage(location.href)) {
      schedule();
    } else {
      releaseHeaderNavSwapEarlyGuard();
    }
  });

  headerNavSwapEarlyCleanup = () => {
    observer.disconnect();
    removeUrlListener();
    restoreHeaderNavSwapEarlyOrder();
    headerNavSwapEarlyCleanup = undefined;
  };

  applyHeaderNavSwapEarlyOrder();
}

function syncHeaderNavSwapEarlyGuard(wantOn: RegistryEntry[]): void {
  if (!isHeaderNavSwapTargetPage(location.href)) {
    releaseHeaderNavSwapEarlyGuard();
    return;
  }

  const wantsHeaderNavSwap = wantOn.some(
    (entry) => entry.author === HEADER_NAV_SWAP_AUTHOR && entry.folder === HEADER_NAV_SWAP_FOLDER,
  );
  if (wantsHeaderNavSwap) {
    ensureHeaderNavSwapEarlyGuard();
  } else {
    releaseHeaderNavSwapEarlyGuard();
  }
}

function releaseHeaderNavSwapEarlyGuard(): void {
  headerNavSwapEarlyCleanup?.();
}

function isExtensionContextInvalidatedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Extension context invalidated');
}

function applyHeaderNavSwapEarlyOrder(): void {
  if (!isHeaderNavSwapTargetPage(location.href)) return;

  const pair = findHeaderNavSwapPair(document);
  if (!pair) return;

  if (!pair.parent.hasAttribute(HEADER_NAV_SWAP_ORIGINAL_ATTR)) {
    pair.parent.setAttribute(HEADER_NAV_SWAP_ORIGINAL_ATTR, currentHeaderNavSwapOrder(pair));
  }

  pair.search.setAttribute('data-crust-nav-swap', 'search');
  pair.alice.setAttribute('data-crust-nav-swap', 'alice');

  if (currentHeaderNavSwapOrder(pair) !== 'alice_first') {
    pair.parent.insertBefore(pair.alice, pair.search);
  }
}

function restoreHeaderNavSwapEarlyOrder(): void {
  const pair = findHeaderNavSwapPair(document);
  if (!pair) return;

  const originalOrder = pair.parent.getAttribute(HEADER_NAV_SWAP_ORIGINAL_ATTR);
  pair.parent.removeAttribute(HEADER_NAV_SWAP_ORIGINAL_ATTR);

  if (originalOrder === 'search_first' && currentHeaderNavSwapOrder(pair) !== 'search_first') {
    pair.parent.insertBefore(pair.search, pair.alice);
  }
  if (originalOrder === 'alice_first' && currentHeaderNavSwapOrder(pair) !== 'alice_first') {
    pair.parent.insertBefore(pair.alice, pair.search);
  }
}

function findHeaderNavSwapPair(root: ParentNode): {
  parent: Element;
  search: Element;
  alice: Element;
} | null {
  const search = root.querySelector(
    '.HeaderNav-Tab[data-tid="www"], a.HeaderNav-Tab[href^="//ya.ru?source=tabbar"]',
  );
  const alice = root.querySelector(
    '.HeaderNav-Tab[data-tid="alice_chat"], a.HeaderNav-Tab[href*="//ya.ru/alice?"]',
  );
  if (!search || !alice || search === alice) return null;

  const parent = search.parentElement;
  if (!parent || parent !== alice.parentElement) return null;
  if (parent.children.length < 2 || parent.children.length > 24) return null;

  return { parent, search, alice };
}

function currentHeaderNavSwapOrder(pair: {
  search: Element;
  alice: Element;
}): 'alice_first' | 'search_first' {
  const position = pair.search.compareDocumentPosition(pair.alice);
  return position & Node.DOCUMENT_POSITION_PRECEDING ? 'alice_first' : 'search_first';
}

function isHeaderNavSwapTargetPage(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return (
      pathname === '/search' ||
      pathname.startsWith('/search/') ||
      pathname === '/alice' ||
      pathname.startsWith('/alice/')
    );
  } catch {
    return false;
  }
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
  moduleKey: string,
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
      experimentId: entry.id,
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
      moduleKey,
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
