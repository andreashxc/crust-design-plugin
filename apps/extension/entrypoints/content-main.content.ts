/**
 * MAIN-world content script entry.
 *
 * Per CONTEXT D-13: this file owns experiments where manifest.world === 'main'.
 * Phase 1's smoke is 'isolated' so this script's filter resolves to empty —
 * BUT the file must exist so the built manifest emits a second content_scripts
 * block with world: 'MAIN', proving ENG-03's declarative routing works.
 */

import type { ApplyFn, CleanupFn } from '@platform/experiment-sdk';
import { ExperimentManifest } from '@platform/experiment-sdk';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { filterByWorld } from '@/content/engine';
import { isExtensionMessage } from '@/shared/messages';
import { getEnabledExperiments, recordLastError } from '@/shared/storage';
import { matchesUrl } from '@/shared/url-match';

export default defineContentScript({
  matches: ['*://*.ya.ru/*', '*://ya.ru/*'],
  runAt: 'document_idle',
  world: 'MAIN', // WXT 0.20.x supports this directly per types.d.mts:703-708.
  main: () => {
    bootstrap('main');
  },
});

type LoadedManifest = {
  manifest: ReturnType<typeof ExperimentManifest.parse>;
  modulePath: string;
};

const cleanups = new Map<string, CleanupFn>();

function bootstrap(world: 'isolated' | 'main'): void {
  const manifestModules = import.meta.glob<{ default: unknown }>('@experiments/*/*/manifest.json', {
    eager: true,
    import: 'default',
  });
  const experimentLoaders = import.meta.glob<{ apply: ApplyFn }>('@experiments/*/*/experiment.ts');

  const loaded: LoadedManifest[] = [];
  for (const [path, raw] of Object.entries(manifestModules)) {
    const parsed = ExperimentManifest.safeParse(raw);
    if (!parsed.success) continue;
    const dir = path.replace(/\/manifest\.json$/, '');
    loaded.push({ manifest: parsed.data, modulePath: `${dir}/experiment.ts` });
  }
  const myWorld = filterByWorld(
    loaded.map((l) => l.manifest),
    world,
  ).map((m) => m.id);
  const myLoaders = loaded.filter((l) => myWorld.includes(l.manifest.id));

  // Note: in MAIN world, chrome.* is NOT available — only chrome.runtime.onMessage,
  // chrome.runtime.connect, chrome.runtime.sendMessage, and chrome.runtime.id are
  // exposed by Chrome to MAIN-world content scripts. chrome.storage is NOT.
  // Per Pitfall 3: this is intentional. Phase 1 has no MAIN experiments, so
  // reconcile() never executes the storage path here. Phase 2/4 will add a
  // postMessage bridge if MAIN experiments need state.
  void reconcile(myLoaders, experimentLoaders);

  chrome.runtime.onMessage.addListener((msg) => {
    if (!isExtensionMessage(msg)) return false;
    if (msg.type === 'STATE_CHANGED') void reconcile(myLoaders, experimentLoaders);
    return false;
  });
}

async function reconcile(
  myLoaders: LoadedManifest[],
  experimentLoaders: Record<string, () => Promise<{ apply: ApplyFn }>>,
): Promise<void> {
  // Phase 1: Phase 1 smoke is 'isolated' — myLoaders is empty here. This function
  // is left in place so Phase 2's first MAIN experiment is a one-line addition.
  if (myLoaders.length === 0) return;

  const enabled = await getEnabledExperiments();
  const wantOn = myLoaders.filter(
    (l) => enabled[l.manifest.id] && matchesUrl(location.href, l.manifest.scope.match),
  );
  const wantOnIds = new Set(wantOn.map((l) => l.manifest.id));

  for (const [id, cleanup] of Array.from(cleanups.entries())) {
    if (!wantOnIds.has(id)) {
      try {
        await cleanup();
      } catch (err) {
        console.error('[engine-main] cleanup failed', id, err);
        await recordLastError(id, String(err)).catch(() => {});
      }
      cleanups.delete(id);
    }
  }
  for (const l of wantOn) {
    if (cleanups.has(l.manifest.id)) continue;
    const id = l.manifest.id;
    try {
      const loader = experimentLoaders[l.modulePath];
      if (!loader) continue;
      const mod = await loader();
      const controller = new AbortController();
      const cleanup = await mod.apply({
        tweaks: {},
        helpers: {
          log: (msg, ...rest) => console.debug('[exp-main]', id, msg, ...rest),
        },
        currentURL: location.href,
        log: (msg, ...rest) => console.debug('[exp-main]', id, msg, ...rest),
        signal: controller.signal,
      });
      cleanups.set(id, cleanup);
    } catch (err) {
      console.error('[engine-main] apply failed', id, err);
      await recordLastError(id, String(err)).catch(() => {});
    }
  }
}
