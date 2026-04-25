/**
 * Isolated-world content script entry.
 *
 * Per CONTEXT D-13: this file owns experiments where manifest.world === 'isolated'.
 * Per SP-3 / BLD-01: experiments are discovered via import.meta.glob from the
 *   @experiments alias (resolves to repo-root experiments/). NO runtime fetch.
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
  // WXT 0.20.x defaults `world` to 'ISOLATED' on IsolatedWorldContentScriptDefinition.
  // Verified in node_modules/wxt/dist/types.d.mts:710 — the default emits no `world`
  // field in the built manifest, which Chrome treats as ISOLATED.
  main: () => {
    bootstrap('isolated');
  },
});

type LoadedManifest = {
  manifest: ReturnType<typeof ExperimentManifest.parse>;
  modulePath: string;
};

/**
 * Cleanup retention is local to this content-script context (NOT the SW).
 * Per SP-1: SW forbids module-scope state. Content scripts are page-scoped and
 * may safely keep a Map<id, CleanupFn> here — they're recreated on every navigation.
 */
const cleanups = new Map<string, CleanupFn>();

function bootstrap(world: 'isolated' | 'main'): void {
  // Static, build-time resolved registry (BLD-01 / SP-3).
  const manifestModules = import.meta.glob<{ default: unknown }>('@experiments/*/*/manifest.json', {
    eager: true,
    import: 'default',
  });
  const experimentLoaders = import.meta.glob<{ apply: ApplyFn }>(
    '@experiments/*/*/experiment.ts',
    // NOT eager — chunk-per-experiment, lazy load (BLD-04 deferred to Phase 2 fully,
    // but Vite's default already produces one chunk per dynamic import target — A6).
  );

  const loaded: LoadedManifest[] = [];
  for (const [path, raw] of Object.entries(manifestModules)) {
    const parsed = ExperimentManifest.safeParse(raw);
    if (!parsed.success) {
      console.error('[content] invalid manifest at runtime', path, parsed.error.issues);
      continue;
    }
    const dir = path.replace(/\/manifest\.json$/, '');
    const modulePath = `${dir}/experiment.ts`;
    loaded.push({ manifest: parsed.data, modulePath });
  }

  const myWorld = filterByWorld(
    loaded.map((l) => l.manifest),
    world,
  ).map((m) => m.id);
  const myLoaders = loaded.filter((l) => myWorld.includes(l.manifest.id));

  // Initial reconcile (covers tabs opened after a previous toggle — RESEARCH R9).
  void reconcile(myLoaders, experimentLoaders);

  // Subsequent reconciles on STATE_CHANGED.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!isExtensionMessage(msg)) return false;
    if (msg.type === 'STATE_CHANGED') {
      void reconcile(myLoaders, experimentLoaders);
    }
    return false;
  });
}

async function reconcile(
  myLoaders: LoadedManifest[],
  experimentLoaders: Record<string, () => Promise<{ apply: ApplyFn }>>,
): Promise<void> {
  const enabled = await getEnabledExperiments();
  const wantOn = myLoaders.filter(
    (l) => enabled[l.manifest.id] && matchesUrl(location.href, l.manifest.scope.match),
  );
  const wantOnIds = new Set(wantOn.map((l) => l.manifest.id));

  // Cleanup any currently-applied experiment that should no longer be on.
  for (const [id, cleanup] of Array.from(cleanups.entries())) {
    if (!wantOnIds.has(id)) {
      try {
        await cleanup();
      } catch (err) {
        console.error('[engine] cleanup failed', id, err);
        await recordLastError(id, String(err)).catch(() => {});
      }
      cleanups.delete(id);
    }
  }

  // Apply any wanted experiment that isn't yet applied.
  for (const l of wantOn) {
    if (cleanups.has(l.manifest.id)) continue;
    const id = l.manifest.id;
    try {
      const loader = experimentLoaders[l.modulePath];
      if (!loader) {
        console.warn('[engine] no loader for', l.modulePath);
        continue;
      }
      const mod = await loader();
      const controller = new AbortController();
      const cleanup = await mod.apply({
        tweaks: {},
        helpers: {
          log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
        },
        currentURL: location.href,
        log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
        signal: controller.signal,
      });
      cleanups.set(id, cleanup);
    } catch (err) {
      // SP-2 per-call isolation
      console.error('[engine] apply failed', id, err);
      await recordLastError(id, String(err)).catch(() => {});
    }
  }
}
