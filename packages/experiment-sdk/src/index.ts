import { z } from 'zod';

/**
 * Manifest schema for `experiments/<author>/<id>/manifest.json`.
 *
 * Source of truth for both the build-time validator (tools/build-experiments.ts)
 * and any future runtime boundary check.
 *
 * Per CONTEXT D-16 + RESEARCH "Zod 4 Schema":
 *   - id is ULID Crockford base32 (26 chars; no I/L/O/U; uppercase only)
 *   - description is short (max 280); long-form description.md is Phase 5 (DX-03)
 *   - tweaks is opaque in Phase 1 — Phase 3 replaces with a discriminated union (RESEARCH R8)
 *   - scope.regex stays optional in Phase 1; Phase 3 wires the matcher (MAN-02)
 */
export const ExperimentManifest = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
  name: z.string().min(1),
  author: z.string().min(1),
  description: z.string().min(1).max(280),
  scope: z.object({
    match: z.array(z.string()).min(1),
    regex: z.array(z.string()).optional(),
  }),
  world: z.enum(['isolated', 'main']).default('isolated'),
  tweaks: z.array(z.unknown()).default([]),
});

export type ExperimentManifest = z.infer<typeof ExperimentManifest>;

/**
 * Phase 1 minimal helpers: just structured logging.
 * Phase 4 (HLP-01..HLP-09) extends with `injectStyle`, `injectNode`, `waitFor`,
 * `onUrlChange`, `llm`, `fetchPage`.
 */
export type Helpers = {
  log: (msg: string, ...args: unknown[]) => void;
};

/**
 * Phase 1 placeholder.
 * Phase 3 (TWK-01) replaces this with a discriminated union covering 6 tweak types.
 */
export type Tweak = unknown;

/**
 * Per CONTEXT D-15 verbatim.
 * `tweaks` is `Record<string, unknown>` (always `{}` in Phase 1) — Phase 3 narrows it.
 * `helpers` is the structural Phase 1 minimum `{ log }` — Phase 4 extends.
 * `signal` lets experiments cooperatively abort async work on cleanup.
 */
export type ApplyArgs = {
  tweaks: Record<string, unknown>;
  helpers: Helpers;
  currentURL: string;
  log: (msg: string, ...args: unknown[]) => void;
  signal: AbortSignal;
};

export type CleanupFn = () => void | Promise<void>;

export type ApplyFn = (args: ApplyArgs) => CleanupFn | Promise<CleanupFn>;

// ===== Phase 2 additions (D-30, D-31) =====

/**
 * Build-time aggregate of every experiment in the repo. Emitted by
 * tools/build-experiments.ts as dist/registry.json (D-16). Consumed by
 * popup (fetch from extension origin), content scripts (filter by world +
 * scope, then load module), and SW (validate toggle id).
 */
export type RegistryEntry = {
  id: string; // ULID Crockford base32 (26 chars), validated at build (Phase 1 D-17)
  author: string; // matches folder name's parent dir, enforced by build plugin (Phase 1 D-18)
  folder: string; // directory name under experiments/<author>/ — emitted by build plugin (Plan 02-04). Used by content-script findLoader to resolve the build-time chunk loader (Warning 6 fix; eliminates the chunkPath regex parse).
  name: string;
  description: string;
  scope: { match: string[]; regex?: string[] };
  world: 'isolated' | 'main';
  chunkPath: string; // relative to extension root, e.g. "chunks/experiments-andrew__smoke-DkJ7g.js" or '' if inlined
  tweaks: unknown[]; // opaque in Phase 2; Phase 3 narrows via discriminated union
};

export type Registry = RegistryEntry[];

/**
 * Five status states per CONTEXT D-08:
 *  - 'disabled': toggle OFF
 *  - 'pending': toggle ON, but active tab URL doesn't match scope
 *  - 'applied': toggle ON, scope matches, last apply succeeded
 *  - 'error': toggle ON, last apply or cleanup threw, count below auto-disable threshold
 *  - 'auto-disabled': engine tripped circuit breaker (≥3 errors in 10s, D-11)
 */
export type ExperimentStatus = 'disabled' | 'pending' | 'applied' | 'error' | 'auto-disabled';

/**
 * One stored error record per experiment (most recent). Persisted to
 * chrome.storage.local under the `last_error` map (D-09 / D-28).
 */
export type ErrorRecord = {
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
  at: number; // Date.now() millis
};

/**
 * Engine kill-switch record per experiment. Persisted to
 * chrome.storage.local under the `autodisabled` map (D-09 / D-28).
 * Cleared on toggle OFF→ON (D-13).
 */
export type AutoDisableRecord = {
  reason: string; // e.g. "≥3 errors in 10s"
  count: number; // number of errors when the breaker tripped
  firstAt: number; // window start, Date.now() millis
  lastAt: number; // most recent error inside the trip window, Date.now() millis
};

/**
 * Pure O(n) lookup helper for Registry. Designers + popup + SW use this for
 * id→entry resolution. ~5 lines per D-31 (zero-runtime SDK is preserved
 * except for this and the existing Zod schema).
 */
export function byId(registry: Registry, id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
