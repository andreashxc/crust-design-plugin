# Phase 3: Tweak System - Research

**Date:** 2026-04-26
**Status:** Ready for planning

## Key Findings

### 1. Tweak Schema Shape

Use a Zod discriminated union on `type`. This keeps build-time manifest errors precise and makes popup rendering exhaustive.

Recommended declarations:

- `toggle`: `{ type, key, label, description?, default: boolean }`
- `select`: `{ type, key, label, description?, default: string, options: { label, value }[] }`
- `text`: `{ type, key, label, description?, default: string, placeholder?, minLength?, maxLength? }`
- `number-slider`: `{ type, key, label, description?, default: number, min, max, step? }`
- `color`: `{ type, key, label, description?, default: "#RRGGBB" }`
- `multi-select`: `{ type, key, label, description?, default: string[], options: { label, value }[] }`

Validation rules:

- keys: non-empty, conservative identifier-ish string (`^[a-zA-Z][a-zA-Z0-9_-]*$`) to stay readable in experiment code.
- option values unique per tweak.
- defaults must be valid for their declared type/options/range.
- manifest-level duplicate keys must be rejected in the build plugin.

### 2. Effective Values

Store per-experiment values under `tweaks:<id>` in `chrome.storage.local`.

Preferred helper split:

- SDK or shared pure code computes defaults and validates values.
- storage adapter only reads/writes raw records.
- content script gets effective validated values before calling `apply()`.

The most stable API:

- `defaultsFromTweaks(tweaks): Record<string, unknown>`
- `mergeTweakValues(tweaks, stored): Record<string, unknown>`
- `validateTweakValues(tweaks, values): { ok: true; values } | { ok: false; errors }`

### 3. Popup Controls

Existing Phase 2 primitives cover Switch/Button/Card/Collapsible/ScrollArea/Badge. Phase 3 needs:

- `input` for text and native color wrapper.
- `slider` for number-slider.
- `select` for select.
- `checkbox` or dropdown-style local component for multi-select.
- optional `label`/`separator` can be simple local markup if shadcn primitives are not needed.

Avoid adding a large third-party color picker. A native color input satisfies the requirement and keeps CSP/simple bundle risk low.

### 4. Debounce

The popup should debounce text and number-slider writes, not content-script applies. That avoids repeated storage writes and repeated broadcasts. A pure hook or helper can be tested with fake timers.

Recommended debounce:

- text: 400ms
- number-slider: 300ms
- toggle/select/color/multi-select: immediate enough for Phase 3; multi-select can write on each checkbox click.

### 5. Reapply Loop

Content script can detect changes by comparing a stable JSON key per experiment:

```ts
JSON.stringify(validatedTweakValues)
```

Store applied entries as `{ cleanup, controller, valuesKey }`. During reconcile:

- if experiment no longer wanted: abort + cleanup + delete.
- if wanted and not applied: apply with values.
- if wanted and valuesKey changed: abort + cleanup, then apply with new values.
- if validation fails: cleanup if currently applied, report/persist validation error, do not call apply.

Validation errors are not engine exceptions and should not trip auto-disable unless routed deliberately as `EXPERIMENT_ERROR`. Prefer a separate `tweak_error:<id>` storage map so bad user input is visible but not treated as experiment code failure.

### 6. URL Regex Fallback

`matchesUrl` should accept a scope object:

```ts
matchesScope(url, { match, regex })
```

Keep `matchesUrl(url, patterns)` as backward-compatible wrapper for existing callers. Regex fallback should run after match patterns. Invalid regex returns false and logs only in dev/test; do not throw at runtime.

### 7. Shadow DOM

WXT provides `createShadowRootUi` for content-script UI mounting. Phase 3 only needs a reference proof, not a full helper framework. A new smoke experiment can mount a small panel in Shadow DOM, return cleanup, and be scoped to ya.ru.

Validation should cover:

- build output includes the experiment.
- enabling the experiment mounts a shadow host.
- host page global styles sampled before/after remain unchanged for selected properties.

## Validation Architecture

Unit tests:

- SDK tweak schema: six valid fixtures, invalid defaults/options/ranges/duplicates.
- storage helpers: get/set/reset values and validation-error map.
- URL matcher: match-pattern + regex fallback + invalid regex.
- popup pure helpers: effective value merge, debounce behavior, renderer dispatch by type.
- content engine: cleanup/apply on changed values, skip apply on invalid values.

Integration/build tests:

- `tools/build-experiments.test.ts` rejects duplicate tweak keys.
- `corepack pnpm build` emits registry with typed tweaks.
- reference experiment with 3+ tweak types builds and appears in registry.

Manual smoke:

- Toggle smoke tweak values in popup and observe cleanup/apply without reload.
- Reset to defaults.
- Confirm popup hides non-matching scope rows.
- Confirm Shadow DOM panel does not alter host page sampled styles.

## Risks

- React popup state can drift from storage if controls keep local state too long. Mitigation: storage remains source of truth; local draft state only for debounced inputs.
- Validation errors could accidentally trigger auto-disable. Mitigation: store tweak validation errors separately from experiment runtime errors.
- Dynamic import cache may prevent updated experiment code from reloading in dev; out of Phase 3, Phase 5 handles HMR.
- Shadow DOM proof can become brittle against ya.ru layout. Keep sampled properties generic and manual checklist explicit.
