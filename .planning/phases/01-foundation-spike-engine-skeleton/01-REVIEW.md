---
phase: 01-foundation-spike-engine-skeleton
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - apps/extension/entrypoints/background.ts
  - apps/extension/entrypoints/content-isolated.content.ts
  - apps/extension/entrypoints/content-main.content.ts
  - apps/extension/entrypoints/popup/App.tsx
  - apps/extension/entrypoints/popup/main.tsx
  - apps/extension/package.json
  - apps/extension/src/content/engine.ts
  - apps/extension/src/content/error-isolation.test.ts
  - apps/extension/src/content/world-routing.test.ts
  - apps/extension/src/shared/messages.ts
  - apps/extension/src/shared/storage.ts
  - apps/extension/src/shared/storage.test.ts
  - apps/extension/src/shared/url-match.ts
  - apps/extension/src/shared/url-match.test.ts
  - apps/extension/src/styles/popup.css
  - apps/extension/src/test-setup/chrome-mock.ts
  - apps/extension/tsconfig.json
  - apps/extension/vitest.config.ts
  - apps/extension/wxt.config.ts
  - biome.json
  - docs/spike/MV3-FOUNDATION.md
  - experiments/andrew/smoke/experiment.ts
  - experiments/andrew/smoke/manifest.json
  - lefthook.yml
  - package.json
  - packages/experiment-sdk/package.json
  - packages/experiment-sdk/src/index.ts
  - packages/experiment-sdk/src/manifest.test.ts
  - packages/experiment-sdk/tsconfig.json
  - packages/experiment-sdk/vitest.config.ts
  - pnpm-workspace.yaml
  - scripts/check-csp.test.ts
  - scripts/check-csp.ts
  - tests/sanity.test.ts
  - tools/build-experiments.test.ts
  - tools/build-experiments.ts
  - tools/package.json
  - tsconfig.base.json
  - tsconfig.json
  - vitest.workspace.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 41 (40 source/config + 1 missing file noted in IN-07)
**Status:** issues_found

## Summary

Phase 1 lays a clean MV3 foundation. The four focus areas the prompt called
out are largely satisfied:

- **Service-worker statelessness (SP-7 / D-12).** `apps/extension/entrypoints/background.ts`
  registers `chrome.runtime.onMessage.addListener` at module scope (line 20)
  before `defineBackground` (line 53) is invoked, so the listener exists in
  the SW's global scope before Chrome dispatches a wake-up event. No
  module-scope mutable state. `apps/extension/src/shared/storage.ts` has zero
  module-level `let`/`var` — every read/write hits `chrome.storage.local`.
- **Per-call try/catch isolation (D-14 / SP-2).** `runEngine` in
  `apps/extension/src/content/engine.ts` and the duplicated reconcile loops
  in both content scripts wrap each `apply()` and each `cleanup()` in its own
  try/catch, log the error, persist `last_error:<id>`, and continue iterating.
  `error-isolation.test.ts` covers the engine path with 5 well-shaped cases.
- **CSP correctness (BLD-05 / D-23).** `scripts/check-csp.ts` blocks `eval(`,
  `new Function(`, and remote `import('https?://…')` with word-boundary regexes.
  Wired into `lefthook.yml` (pre-commit) and `.github/workflows/ci.yml`. Test
  coverage in `scripts/check-csp.test.ts` is solid (12 cases, including
  word-boundary `evaluator()`-not-flagged and ignored-directories).
- **Zod schema soundness (D-16).** `packages/experiment-sdk/src/index.ts`
  pins ULID Crockford regex (32-char alphabet, length 26), bounds description
  to 280 chars, defaults `world` to `'isolated'`, defaults `tweaks` to `[]`.
  `manifest.test.ts` exercises 14 valid/invalid cases including I/L/O/U
  rejection and length/case enforcement.
- **Vite plugin idempotency (D-17 / D-18).** `tools/build-experiments.ts`'s
  ULID write-back is keyed on missing/empty/null `id`, preserves canonical
  formatting (2-space indent + trailing newline), and is exercised by an
  idempotency test (second scan does not rewrite).
- **Two-world routing (D-13 / ENG-03).** `filterByWorld` is pure and tested
  with 6 cases. The MV3 manifest correctly emits a second `content_scripts`
  block with `"world": "MAIN"` per the spike report.

The five warnings below are all real but Phase 1-scoped — they document
latent bugs and gaps that should be tracked, not blockers. None are security
issues.

## Warnings

### WR-01: AbortController.abort() never called on cleanup — `signal` is non-functional in Phase 1

**File:** `apps/extension/entrypoints/content-isolated.content.ts:117`, `apps/extension/entrypoints/content-main.content.ts:101`, `apps/extension/src/content/engine.ts:59`

**Issue:** A fresh `AbortController` is created for every `apply()` call and
its `controller.signal` is passed into the experiment per the SDK contract
(`packages/experiment-sdk/src/index.ts:52` — "`signal` lets experiments
cooperatively abort async work on cleanup"). However, `controller.abort()` is
never called — not in the cleanup branch (content-isolated.content.ts:97),
not on apply-failure (line 130), not when the content-script context tears
down. The signal is dead-on-arrival. Any experiment that wires `signal` into
a `fetch()` or `addEventListener({signal})` will leak that work forever.

The smoke experiment doesn't use `signal`, so the bug is invisible today —
but the SDK type advertises a contract the runtime doesn't honor. Phase 2 or
Phase 4 callers WILL rely on this and the failure will be confusing.

**Fix:** Store the controller alongside the cleanup, abort on the cleanup
path:

```ts
// In content-isolated.content.ts (and mirror in content-main.content.ts):
const cleanups = new Map<string, { fn: CleanupFn; controller: AbortController }>();

// On apply success:
cleanups.set(id, { fn: cleanup, controller });

// On the cleanup branch (line ~96):
for (const [id, entry] of Array.from(cleanups.entries())) {
  if (!wantOnIds.has(id)) {
    entry.controller.abort(); // <-- new: signal cooperative abort BEFORE cleanup
    try {
      await entry.fn();
    } catch (err) {
      console.error('[engine] cleanup failed', id, err);
      await recordLastError(id, String(err)).catch(() => {});
    }
    cleanups.delete(id);
  }
}
```

Apply the same change in `engine.ts:runEngine` (or, better, retire `runEngine`
once Phase 2 unifies the two reconcile loops — see WR-04).

---

### WR-02: `isExtensionMessage` type guard does not validate payload shape

**File:** `apps/extension/src/shared/messages.ts:11-15`

**Issue:** The guard checks only `value.type`. A malformed
`{ type: 'EXPERIMENT_TOGGLE' }` (missing `id` and `enabled`) passes the
guard, then `handleToggle(msg.id, msg.enabled)` in
`apps/extension/entrypoints/background.ts:25` is called with `undefined`
arguments. `setEnabledExperiment(undefined, undefined)` then writes
`{ undefined: undefined }` into `chrome.storage.local`. There is no input
validation on the SW side.

In Phase 1 the only sender is the popup's own
`chrome.runtime.sendMessage({ type: 'EXPERIMENT_TOGGLE', id, enabled })`, so
a malformed message can only arrive if a future code path or another
extension's content script sends one. Still, the SW is the trust boundary —
it should validate.

**Fix:** Tighten the guard or validate inside the listener:

```ts
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { type?: unknown; id?: unknown; enabled?: unknown };
  if (v.type === 'STATE_CHANGED') return true;
  if (v.type === 'EXPERIMENT_TOGGLE') {
    return typeof v.id === 'string' && typeof v.enabled === 'boolean';
  }
  return false;
}
```

A more durable Phase-2 alternative is a Zod-validated message schema, which
the codebase will adopt when `@webext-core/messaging` lands per the
`messages.ts` docblock.

---

### WR-03: Production reconcile path is untested; only `runEngine` (parallel implementation) is tested

**File:** `apps/extension/entrypoints/content-isolated.content.ts:83-134`, `apps/extension/entrypoints/content-main.content.ts:69-117`

**Issue:** `error-isolation.test.ts` and `world-routing.test.ts` exercise
`apps/extension/src/content/engine.ts` (`runEngine` and `filterByWorld`).
But the actual production code paths in `content-isolated.content.ts` and
`content-main.content.ts` re-implement the reconcile loop inline (cleanup
on world-mismatch, apply on enabled, cleanup-on-disable, last_error
recording). The two implementations are similar but not identical:

- The content-script versions add cleanup-on-disable (engine doesn't).
- The content-script versions check `cleanups.has(l.manifest.id)` to skip
  re-apply (engine doesn't track this).
- The content-script versions do `matchesUrl(location.href, …)` filtering
  (engine doesn't).

So the SP-2 error-isolation tests prove the property for code that doesn't
ship. A regression in the content-script reconcile loop (e.g., someone
re-orders the try/catch) would not be caught.

**Fix:** Either (a) extract the reconcile loop into a single function in
`engine.ts` that takes a "world filter + url + cleanups Map" and have both
content scripts call it, then test that function; or (b) write content-script
integration tests that drive the bootstrap path with a mocked DOM and chrome
API. Option (a) also resolves WR-04 below. Phase 2 is the natural place for
this refactor; flag it as tech debt now so it doesn't ossify.

---

### WR-04: `runEngine` is exported but unused — dead production code, parallel maintenance burden

**File:** `apps/extension/src/content/engine.ts:45-80`

**Issue:** `runEngine` is exported and tested but never imported by any
production code (verify: `grep -rn 'runEngine' apps/ experiments/ packages/`
finds only the tests and the export site). Both content scripts duplicate
its logic inline. This creates two failure modes:

1. Bugfixes to one path (engine OR content scripts) silently miss the
   other — the next reviewer will assume the test coverage applies to the
   shipping code (it doesn't; see WR-03).
2. The `signal`/AbortController contract drifts between the two
   implementations (already true — see WR-01).

**Fix:** Either delete `runEngine` (and re-target its tests at the content
scripts via integration testing) or — better — make the content scripts
actually call it. The current docblock at engine.ts:36-43 acknowledges the
gap ("this Phase 1 version does NOT yet manage cleanups… Phase 2 will add
a cleanup registry") which is fair, but the export should be marked
`@internal` or moved to a `__tests__` helper to make the intent explicit
until Phase 2 lands the unification.

---

### WR-05: Optimistic UI in popup never reverts on failed toggle; `sendMessage` rejection is silent

**File:** `apps/extension/entrypoints/popup/App.tsx:29-32`

**Issue:** The toggle handler does `setEnabled(prev => …)` (optimistic) and
then fires `chrome.runtime.sendMessage(...)` without awaiting or handling
rejection. If the SW handler returns `{ ok: false, error }`
(`apps/extension/entrypoints/background.ts:29`), the popup never sees it —
the message ID just gets dropped. The user thinks the toggle succeeded; the
storage value didn't change; the next popup open will reveal the lie.

**Fix:** Either await the response and revert the optimistic update on
failure, or refresh from storage after a small delay. The minimal patch:

```tsx
const handleToggle = async (id: string, next: boolean) => {
  setEnabled((prev) => ({ ...prev, [id]: next }));
  try {
    const reply = (await chrome.runtime.sendMessage({
      type: 'EXPERIMENT_TOGGLE',
      id,
      enabled: next,
    })) as { ok: boolean; error?: string } | undefined;
    if (!reply?.ok) {
      // Revert optimistic update.
      setEnabled((prev) => ({ ...prev, [id]: !next }));
      console.error('[popup] toggle failed', reply?.error);
    }
  } catch (err) {
    setEnabled((prev) => ({ ...prev, [id]: !next }));
    console.error('[popup] toggle threw', err);
  }
};
```

Phase 1 may legitimately defer this to UX polish (DX-style), but it's a real
correctness bug in the popup-SW contract worth recording.

---

## Info

### IN-01: `getEnabledExperiments` casts without per-key validation

**File:** `apps/extension/src/shared/storage.ts:13-15`

**Issue:** The check confirms `value` is an object but does not verify each
entry is `boolean`. A corrupted storage value `{ a: 'oops' }` would pass
through and be returned typed as `Record<string, boolean>`, which then
flows into `enabled[l.manifest.id]` in the reconcile loops. JS-truthy would
still toggle the experiment ON (a non-empty string is truthy), so the
runtime impact is benign in Phase 1, but the type is a soft lie.

**Fix:** Filter to boolean entries:

```ts
const out: Record<string, boolean> = {};
for (const [k, v] of Object.entries(value)) {
  if (typeof v === 'boolean') out[k] = v;
}
return out;
```

---

### IN-02: `findRepoRoot` is exported but never called

**File:** `tools/build-experiments.ts:152-166`

**Issue:** `findRepoRoot` is exported and not referenced anywhere in the
repo (`apps/`, `tools/`, `packages/`, `scripts/`, `experiments/`). The
`buildExperiments` plugin defaults `root` to `process.cwd()` and
`wxt.config.ts:8` passes an explicit `repoRoot`. Dead export.

**Fix:** Delete the function or document it as a planned Phase 2 utility
(e.g., for a future CLI). If retained, move to `// @internal`.

---

### IN-03: `engine.ts:runEngine` double-filters by world

**File:** `apps/extension/src/content/engine.ts:53`

**Issue:** Callers are expected to pre-filter via `filterByWorld`, but
`runEngine` re-filters on line 53. Benign (idempotent) but inconsistent — a
caller could legitimately expect either behaviour. Pick one.

**Fix:** Either drop the in-engine filter (rely on caller) or drop the
expectation that the caller pre-filters (the test uses both, which obscures
the contract). Tied to WR-04.

---

### IN-04: Hardcoded `matches` in content-script entrypoints will not honour future experiment scope changes

**File:** `apps/extension/entrypoints/content-isolated.content.ts:18`, `apps/extension/entrypoints/content-main.content.ts:19`

**Issue:** Both content-script `defineContentScript` declarations hardcode
`matches: ['*://*.ya.ru/*', '*://ya.ru/*']`. The engine then re-checks via
`matchesUrl(location.href, l.manifest.scope.match)`, but if a future
experiment declares a manifest scope outside ya.ru, the content script
never injects on that domain in the first place — the engine's filter
becomes dead code.

This is intentional for Phase 1 (one host). Phase 2/3 needs to either
generate the `matches` from the union of all manifest scopes (build-time)
or move to dynamic `chrome.scripting.registerContentScripts`. Just record
the gap.

**Fix:** No code change for Phase 1. Add a comment in both files pointing
to the Phase 2 follow-up, or open a tracked tech-debt note.

---

### IN-05: `tools/package.json` has no `test` script; tools tests run only via root vitest config

**File:** `tools/package.json:1-20`

**Issue:** `packages/experiment-sdk/package.json` and
`apps/extension/package.json` both define a `test` script. `tools/` does
not. Tests under `tools/build-experiments.test.ts` are picked up by the
root `vitest.config.ts`'s `tools/**/*.test.ts` glob, so `pnpm test` at the
root works — but `pnpm -F @platform/build-tools test` would fail. Minor
inconsistency.

**Fix:** Add a `"test": "vitest"` script (and a vitest config in
`tools/`) or document that build-tools tests are root-only.

---

### IN-06: `App.tsx` cosmetic — initial render shows all checkboxes unchecked then flickers to true state

**File:** `apps/extension/entrypoints/popup/App.tsx:23-27`

**Issue:** `enabled` initializes to `{}` synchronously, then the
`useEffect` resolves `getEnabledExperiments()` and overwrites. On a popup
open with one or more experiments enabled, the user sees a one-frame flash
of "all unchecked." Not a correctness bug; user-perceptible flicker.

**Fix:** Initialise via Suspense, or render a small "loading…" placeholder
until storage resolves. Phase 5 DX-territory; record now.

---

### IN-07: Config block lists `vitest.workspace.ts` but the file does not exist; root config is `vitest.config.ts`

**File:** `vitest.workspace.ts` (referenced in config but not present in repo)

**Issue:** The `<config>` block for this review listed
`vitest.workspace.ts` among the files. The repo's actual root vitest
config is `vitest.config.ts` (using Vitest 4's `test.projects` API; the
`defineWorkspace` pattern was removed in Vitest 4). `vitest.workspace.ts`
does not exist on disk. The config-block reference is stale and should be
corrected to `vitest.config.ts` for future reviews. The actual `vitest.config.ts`
file is correctly written for the Vitest 4 API and ties the per-package
configs together.

**Fix:** Update the phase plan / orchestrator file list to point to
`vitest.config.ts`. No code change.

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
