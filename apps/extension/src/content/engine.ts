import type { ApplyFn, ExperimentManifest } from '@platform/experiment-sdk';
import { recordLastError } from '@/shared/storage';

export type EngineWorld = 'isolated' | 'main';

export type LoadedExperiment = {
  manifest: ExperimentManifest;
  load: () => Promise<{ apply: ApplyFn }>;
};

/**
 * Filter manifests by the world the current content script runs in.
 * Per CONTEXT D-13: routing is declarative — a manifest's world field decides which
 * content script (isolated or main) loads it. The Zod schema defaults missing
 * world to 'isolated' (CONTEXT D-16), so by the time a manifest reaches this
 * function it always has a non-null world.
 */
export function filterByWorld(
  manifests: ExperimentManifest[],
  world: EngineWorld,
): ExperimentManifest[] {
  return manifests.filter((m) => m.world === world);
}

/**
 * Run the apply phase for a set of pre-loaded experiments.
 *
 * Per CONTEXT D-14 + ENG-05 + PATTERNS SP-2:
 *   - Each apply() call is wrapped in its OWN try/catch.
 *   - A failure in one experiment MUST NOT prevent subsequent experiments from running.
 *   - Errors are logged AND written to chrome.storage.local under last_error:<id>.
 *
 * Per RESEARCH Step 4.4 inline code shape, the apply args follow CONTEXT D-15.
 *
 * Returns lists of applied + failed ids so callers (content scripts) can store cleanups.
 * Note: this Phase 1 version does NOT yet manage cleanups — cleanups are returned
 * via the side-effect of the caller wiring them. Phase 2 will add a cleanup registry.
 * Right now: callers can iterate experiments, call apply individually with try/catch
 * mirroring this loop, and store the returned CleanupFn in their own Map<id, CleanupFn>.
 *
 * For Phase 1's purposes (proving error isolation), this function applies and
 * REPORTS — it does not retain cleanups. The content script entry (Task 3) wraps
 * this same loop and stores cleanups locally.
 */
export async function runEngine(args: {
  experiments: LoadedExperiment[];
  world: EngineWorld;
  currentURL: string;
}): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];

  const filtered = args.experiments.filter((e) => e.manifest.world === args.world);

  for (const exp of filtered) {
    const id = exp.manifest.id;
    try {
      const mod = await exp.load();
      const controller = new AbortController();
      await mod.apply({
        tweaks: {},
        helpers: {
          log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
        },
        currentURL: args.currentURL,
        log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
        signal: controller.signal,
      });
      applied.push(id);
    } catch (err) {
      // SP-2: continue loop even on failure
      console.error('[engine] apply failed', id, err);
      await recordLastError(id, String(err)).catch(() => {
        // recording failure must also not break the loop
      });
      failed.push(id);
    }
  }
  return { applied, failed };
}
