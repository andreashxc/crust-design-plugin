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
 *   - tweaks uses the Phase 3 typed discriminated union (RESEARCH R8)
 *   - scope.regex stays optional in Phase 1; Phase 3 wires the matcher (MAN-02)
 */
const tweakKey = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
const tweakOption = z.string().min(1);
const colorValue = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const tweakBase = z.object({
  key: tweakKey,
  label: z.string().min(1),
  description: z.string().min(1).optional(),
});

const ToggleTweakDefinition = tweakBase.extend({
  type: z.literal('toggle'),
  default: z.boolean(),
});

const SelectTweakDefinition = tweakBase
  .extend({
    type: z.literal('select'),
    options: z.array(tweakOption).min(1),
    default: tweakOption,
  })
  .superRefine((tweak, ctx) => {
    if (!tweak.options.includes(tweak.default)) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'Select default must be one of options',
      });
    }
  });

const TextTweakDefinition = tweakBase.extend({
  type: z.literal('text'),
  default: z.string(),
  placeholder: z.string().optional(),
});

const NumberSliderTweakDefinition = tweakBase
  .extend({
    type: z.literal('number-slider'),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    default: z.number(),
  })
  .superRefine((tweak, ctx) => {
    if (tweak.min >= tweak.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'Slider max must be greater than min',
      });
    }
    if (tweak.default < tweak.min || tweak.default > tweak.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'Slider default must be within min and max',
      });
    }
  });

const ColorTweakDefinition = tweakBase.extend({
  type: z.literal('color'),
  default: colorValue,
});

const MultiSelectTweakDefinition = tweakBase
  .extend({
    type: z.literal('multi-select'),
    options: z.array(tweakOption).min(1),
    default: z.array(tweakOption),
  })
  .superRefine((tweak, ctx) => {
    const unknown = tweak.default.filter((value) => !tweak.options.includes(value));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: 'Multi-select default values must be included in options',
      });
    }
  });

export const TweakDefinition = z.discriminatedUnion('type', [
  ToggleTweakDefinition,
  SelectTweakDefinition,
  TextTweakDefinition,
  NumberSliderTweakDefinition,
  ColorTweakDefinition,
  MultiSelectTweakDefinition,
]);

export type TweakDefinition = z.infer<typeof TweakDefinition>;

export type TweakValue = boolean | string | number | string[];
export type TweakValueMap = Record<string, TweakValue>;

export type TweakValidationError = {
  path?: Array<string | number>;
  message: string;
  code?: string;
};

export class TweakValueValidationError extends Error {
  readonly issues: TweakValidationError[];

  constructor(issues: z.core.$ZodIssue[]) {
    super('Invalid tweak values');
    this.name = 'TweakValueValidationError';
    this.issues = issues.map((issue) => ({
      path: issue.path.filter((part): part is string | number => typeof part !== 'symbol'),
      message: issue.message,
      code: issue.code,
    }));
  }
}

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
  tweaks: z.array(TweakDefinition).default([]),
});

export type ExperimentManifest = z.infer<typeof ExperimentManifest>;

export type LlmProvider = 'openai' | 'anthropic';

export type LlmUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type LlmOptions = {
  provider?: LlmProvider;
  model?: string;
  maxOutputTokens?: number;
  cacheKey?: string;
  cacheTtlMs?: number;
  stream?: false;
};

export type LlmStreamOptions = Omit<LlmOptions, 'stream'> & {
  stream: true;
  onDelta?: (delta: string) => void;
};

export type LlmResult = {
  text: string;
  provider: LlmProvider;
  model: string;
  cached: boolean;
  usage?: LlmUsage;
};

export type FetchPageResult =
  | {
      ok: true;
      url: string;
      html: string;
      text: string;
      title?: string;
      selector?: string;
    }
  | {
      ok: false;
      url: string;
      reason:
        | 'network_error'
        | 'not_html'
        | 'likely_spa_shell'
        | 'selector_not_found'
        | 'too_large';
      message: string;
    };

export type InjectStyleOptions = {
  id?: string;
  target?: 'head' | 'body';
};

export type InjectNodeOptions = {
  position?: InsertPosition;
};

export type WaitForOptions = {
  timeoutMs?: number;
  root?: ParentNode;
};

export type UrlChangeCleanup = () => void;

/**
 * Experiment helper contract. `log` is the original Phase 1 minimum; Phase 4
 * adds privileged helpers and auto-tracked side effects.
 */
export type Helpers = {
  log: (msg: string, ...args: unknown[]) => void;
  llm: {
    (prompt: string, options?: LlmOptions): Promise<string>;
    (prompt: string, options: LlmStreamOptions): Promise<LlmResult>;
  };
  fetchPage: (url: string, selector?: string) => Promise<FetchPageResult>;
  injectStyle: (css: string, options?: InjectStyleOptions) => HTMLStyleElement;
  injectNode: <TNode extends Node>(
    node: TNode,
    target?: ParentNode,
    options?: InjectNodeOptions,
  ) => TNode;
  waitFor: <TElement extends Element = Element>(
    selector: string,
    options?: WaitForOptions,
  ) => Promise<TElement>;
  onUrlChange: (callback: (url: string) => void) => UrlChangeCleanup;
};

/**
 * Back-compat alias for callers that imported the Phase 1 placeholder.
 */
export type Tweak = TweakDefinition;

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
  tweaks: TweakDefinition[];
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

function valueSchemaFor(tweak: TweakDefinition): z.ZodType<TweakValue> {
  switch (tweak.type) {
    case 'toggle':
      return z.boolean();
    case 'select':
      return z.enum(tweak.options as [string, ...string[]]);
    case 'text':
      return z.string();
    case 'number-slider':
      return z.number().min(tweak.min).max(tweak.max);
    case 'color':
      return colorValue;
    case 'multi-select':
      return z.array(z.enum(tweak.options as [string, ...string[]]));
  }
}

export function defaultTweakValues(tweaks: TweakDefinition[]): TweakValueMap {
  return Object.fromEntries(tweaks.map((tweak) => [tweak.key, tweak.default]));
}

export function validateTweakValues(
  tweaks: TweakDefinition[],
  values: Record<string, unknown>,
): TweakValueMap {
  const shape = Object.fromEntries(
    tweaks.map((tweak) => [tweak.key, valueSchemaFor(tweak).default(tweak.default)]),
  );
  const result = z.object(shape).strict().safeParse(values);
  if (!result.success) {
    throw new TweakValueValidationError(result.error.issues);
  }
  return result.data;
}

export function mergeTweakValues(
  tweaks: TweakDefinition[],
  stored: Record<string, unknown>,
): TweakValueMap {
  const values = defaultTweakValues(tweaks);
  for (const tweak of tweaks) {
    if (!(tweak.key in stored)) continue;
    const result = valueSchemaFor(tweak).safeParse(stored[tweak.key]);
    if (result.success) values[tweak.key] = result.data;
  }
  return values;
}
