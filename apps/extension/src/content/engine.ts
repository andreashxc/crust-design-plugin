import type { ApplyFn, ExperimentManifest } from '@platform/experiment-sdk';
import { createHelpers } from '@/content/helpers';
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
export function filterByWorld<T extends ExperimentManifest>(
  manifests: T[],
  world: EngineWorld,
): T[] {
  return manifests.filter((m) => m.world === world);
}

export function filterAutoDisabled<T extends { id: string }>(
  entries: T[],
  autodisabled: Record<string, unknown>,
): T[] {
  return entries.filter((entry) => !autodisabled[entry.id]);
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function stableTweakValuesKey(values: Record<string, unknown>): string {
  return JSON.stringify(sortRecord(values));
}

export function shouldReapplyForTweakValues(
  appliedValuesKey: string | undefined,
  nextValues: Record<string, unknown>,
): boolean {
  return appliedValuesKey !== stableTweakValuesKey(nextValues);
}

function sortRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecord);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortRecord(nested)]),
  );
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
        helpers: createHelpers({ experimentId: id }),
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
