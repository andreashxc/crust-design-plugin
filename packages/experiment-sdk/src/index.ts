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

// ============================================================================
// Phase 2 additions (D-30, D-31)
// ============================================================================

/**
 * Phase 2: registry entry shape emitted by the build plugin into
 * `dist/registry.json`. Consumed by popup, SW, and content scripts.
 *
 * Per CONTEXT D-16 + Warning 6 fix (checker iter 1): includes `folder` so
 * content scripts resolve loaders directly from manifest, not via fragile
 * chunkPath regex.
 */
export type RegistryEntry = {
  id: string; // ULID Crockford base32 (26 chars)
  author: string; // matches folder name under experiments/
  folder: string; // directory name under experiments/<author>/ (Warning 6 fix)
  name: string;
  description: string;
  scope: { match: string[]; regex?: string[] };
  world: 'isolated' | 'main';
  chunkPath: string; // relative to extension root, e.g. "experiments/andrew-01HXX....js"
  tweaks: unknown[]; // opaque in Phase 2; Phase 3 narrows via discriminated union
};

export type Registry = RegistryEntry[];

/**
 * Phase 2: 5-state status model per popup row (D-08).
 */
export type ExperimentStatus = 'disabled' | 'pending' | 'applied' | 'error' | 'auto-disabled';

/**
 * Phase 2: per-experiment last-error record stored in `last_error` map (D-09).
 */
export type ErrorRecord = {
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
  at: number;
};

/**
 * Phase 2: auto-disable trip record stored in `autodisabled` map (D-09 / D-12).
 */
export type AutoDisableRecord = {
  reason: string;
  count: number;
  firstAt: number;
  lastAt: number;
};

/**
 * Phase 2: pure O(1) registry lookup helper.
 * Zero-runtime stays the rule — `byId` is ~5 lines, no deps.
 */
export function byId(registry: Registry, id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
