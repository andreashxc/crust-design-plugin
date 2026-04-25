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
