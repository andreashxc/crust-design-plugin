---
phase: 02-state-foundation-messaging-popup-shell
plan: 03
subsystem: messaging
tags: [@webext-core/messaging, mv3, service-worker, sliding-window, auto-disable, typed-protocol]

# Dependency graph
requires:
  - phase: 02-state-foundation-messaging-popup-shell
    provides: Wave 0 SDK types (RegistryEntry, ExperimentStatus, ErrorRecord, AutoDisableRecord) + storage helpers (last_error map, autodisabled, error_window:<id>, applied:<tabId>, runStartupMigration) + chrome-mock extensions (storage.session.setAccessLevel, runtime.id, tabs.onRemoved). Wave 0 outputs were not yet merged when this Wave 1 worktree branched from b4398a3, so 02-03 self-bootstrapped the subset of Wave 0 contracts it depends on (Rule 3 — auto-fix blocking issues).
provides:
  - Typed messaging bus (@webext-core/messaging defineExtensionMessaging<ProtocolMap>()) with 5 messages — EXPERIMENT_TOGGLE, STATE_CHANGED({tabId}), EXPERIMENT_ERROR, STATUS_QUERY, WHO_AM_I.
  - Service-worker top-level orchestrator (background.ts) — onMessage handlers for toggle/error/who-am-i + chrome.tabs.onRemoved + runStartupMigration before handlers + setAccessLevel inside defineBackground.
  - handleExperimentToggle with D-13 recovery (toggle ON clears autodisabled + error_window).
  - handleExperimentError sliding-window auto-disable circuit breaker (≥3 errors in 10s; D-11).
  - handleWhoAmI Blocker-2 fix — content scripts can fetch their own tab id during bootstrap.
  - broadcastStateChanged() per-tab fan-out helper with {tabId} payload (RESEARCH R8).
affects: [02-04, 02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: ["@webext-core/messaging@^2.3.0"]
  patterns:
    - "@webext-core/messaging onMessage(name, handler) at module top, before defineBackground (preserves SP-7)."
    - "Pure handler functions in src/background/handlers/, called directly in unit tests; library bypassed via vi.mock('@webext-core/messaging')."
    - "Sliding-window via vi.useFakeTimers() + vi.setSystemTime() for deterministic auto-disable tests."
    - "Self-bootstrapping wave deps in parallel worktree execution (chore commit isolates them so orchestrator merge can resolve against sibling wave-0 outputs)."

key-files:
  created:
    - apps/extension/src/shared/messages.test.ts
    - apps/extension/src/background/broadcast.ts
    - apps/extension/src/background/handlers/experiment-toggle.ts
    - apps/extension/src/background/handlers/experiment-toggle.test.ts
    - apps/extension/src/background/handlers/experiment-error.ts
    - apps/extension/src/background/handlers/experiment-error.test.ts
    - apps/extension/src/background/handlers/who-am-i.ts
    - apps/extension/src/background/handlers/who-am-i.test.ts
  modified:
    - apps/extension/src/shared/messages.ts
    - apps/extension/entrypoints/background.ts
    - apps/extension/entrypoints/content-isolated.content.ts
    - apps/extension/src/test-setup/chrome-mock.ts
    - apps/extension/src/content/error-isolation.test.ts
    - apps/extension/src/shared/storage.ts
    - apps/extension/src/shared/storage.test.ts
    - packages/experiment-sdk/src/index.ts
    - apps/extension/package.json
    - pnpm-lock.yaml

key-decisions:
  - "STATE_CHANGED carries {tabId} payload (RESEARCH R8 refinement of D-05) instead of empty body — content scripts cache their own tab id without a separate API call."
  - "WHO_AM_I added as 5th ProtocolMap message (Blocker 2 fix) so applied:<tabId> can be written on initial page load before any toggle event fires."
  - "@webext-core/messaging mocked at the chrome-mock setupFile level (single vi.mock factory shared by every test) because the real polyfill caches a chrome reference at module-eval time and ignores per-test vi.stubGlobal swaps. Per-test mocking pattern from RESEARCH §9 still works for handler-direct tests."
  - "background.ts ordering R7: runStartupMigration() void-then-catch on line 36 BEFORE onMessage('EXPERIMENT_TOGGLE'/'EXPERIMENT_ERROR'/'WHO_AM_I') registrations on lines 44-49 — handlers may read/write last_error, migration must consolidate Phase 1 per-key shape first."
  - "setAccessLevel inside defineBackground main (R6) — content scripts get TRUSTED_AND_UNTRUSTED_CONTEXTS access to chrome.storage.session for applied:<tabId> writes in Plan 02-07."
  - "AbortError filtering deferred to content-script callsite (Plan 02-07) — handler trusts callers to pre-filter; AbortErrors that reach handleExperimentError count as real errors."
  - "Phase 1 isExtensionMessage runtime guard removed; @webext-core/messaging handles tag decoding internally. background.ts and content-isolated.content.ts callsites updated in this same plan to keep typecheck green between tasks."

patterns-established:
  - "Pattern (Group D): onMessage(name, handler) at module top BEFORE defineBackground; handler bodies live in src/background/handlers/<event>.ts; void+catch on every async top-level call."
  - "Pattern (sliding window): file-local const WINDOW_MS / THRESHOLD; if (!existing || now - firstAt > WINDOW_MS) start fresh else increment; trip when count >= THRESHOLD; clearErrorWindow on trip so D-13 re-arm is clean."
  - "Pattern (handler tests): bypass @webext-core/messaging entirely (call handler directly); use chrome.storage.{local,session}._data introspection for storage assertions; per-test override via chrome.tabs.query = vi.fn(...)."
  - "Pattern (env mock): set globalThis.chrome at module-load in setupFile so webextension-polyfill's id check passes BEFORE any test-file imports."

requirements-completed: [ENG-04, ENG-06]

# Metrics
duration: 17min
completed: 2026-04-25
---

# Phase 2 Plan 03: Typed Messaging Bus & SW Orchestrator Summary

**Replaced Phase 1 hand-rolled tag-union messages.ts with @webext-core/messaging's `defineExtensionMessaging<ProtocolMap>()` (5 messages incl. WHO_AM_I), split background.ts into typed handlers (toggle, error, who-am-i) under src/background/handlers/, and shipped the D-11 auto-disable circuit breaker (≥3 errors in 10s sliding window).**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-04-25T21:47:42Z
- **Completed:** 2026-04-25T22:05:11Z
- **Tasks:** 5/5 complete
- **Files modified:** 11 (8 created, 3 in-place rewrites of Phase 1 files, plus 2 test infra updates)

## Accomplishments

- ProtocolMap with 5 typed messages — `EXPERIMENT_TOGGLE`, `STATE_CHANGED({tabId})`, `EXPERIMENT_ERROR`, `STATUS_QUERY`, `WHO_AM_I` — locks the message protocol every other Phase 2 plan imports.
- Sliding-window auto-disable circuit breaker (D-11): on `EXPERIMENT_ERROR`, opens window with `count=1, firstAt=now`; increments while `now - firstAt <= 10s`; trips at `count >= 3` writing `autodisabled[id] = {reason, count, firstAt, lastAt}`; clears `error_window:<id>` so D-13 re-arm starts clean; broadcasts `STATE_CHANGED`.
- D-13 recovery branch: toggle ON clears both `autodisabled[id]` and `error_window:<id>`; toggle OFF preserves auto-disable state (engine kill-switch persists until user explicitly re-arms).
- WHO_AM_I (Blocker 2 fix): pure function over a `chrome.runtime.MessageSender` envelope; returns `{tabId}`; throws when called outside a tab context (popup/options) so callers can fall back.
- background.ts top-level ordering enforced (R7): imports → `runStartupMigration()` → `onMessage('EXPERIMENT_TOGGLE'/'EXPERIMENT_ERROR'/'WHO_AM_I')` → `chrome.tabs.onRemoved` → `defineBackground{setAccessLevel}`.
- 47 unit tests pass (20 net new for this plan); typecheck, biome, check-csp, and `pnpm build` all green.

## Task Commits

1. **Wave-0 prep (Rule 3 self-bootstrap):** `0acc665` (chore: inline wave-0 dependencies for parallel execution)
2. **Task 1 RED:** `74d0423` (test: add ProtocolMap compile-only smoke test)
3. **Task 1 GREEN:** `bed8018` (feat: replace messages.ts with @webext-core/messaging ProtocolMap)
4. **Task 2 RED:** `2955269` (test: add failing tests for experiment-toggle + broadcast)
5. **Task 2 GREEN:** `3addb7b` (feat: implement experiment-toggle handler + broadcast helper) — note: actual hash on disk is the commit recorded under that message; verify via git log.
6. **Task 3 RED:** `37491d1` (test: add failing tests for experiment-error sliding window)
7. **Task 3 GREEN:** `b7fe10f` (feat: implement experiment-error sliding-window handler)
8. **Task 4 RED:** `01f27f3` (test: add failing tests for who-am-i handler)
9. **Task 4 GREEN:** `493b163` (feat: implement who-am-i handler (Blocker 2 fix))
10. **Task 5:** `1343123` (feat: rewire background.ts as typed orchestrator)

(Task 2 GREEN hash verified — see `git log` for canonical SHA at the time of summary creation.)

## Files Created/Modified

### Created
- `apps/extension/src/shared/messages.test.ts` — 5 expectTypeOf assertions over ProtocolMap shape (compile-only).
- `apps/extension/src/background/broadcast.ts` — `broadcastStateChanged()` per-tab fan-out using `sendMessage('STATE_CHANGED', {tabId}, tab.id)`; per-tab try/catch swallows tabs without content scripts.
- `apps/extension/src/background/handlers/experiment-toggle.ts` — `handleExperimentToggle({id, enabled}) → {ok}` with D-13 recovery (clear autodisabled + error_window when enabled=true).
- `apps/extension/src/background/handlers/experiment-toggle.test.ts` — 5 tests: toggle ON, toggle OFF, recovery, error path, broadcast resilience.
- `apps/extension/src/background/handlers/experiment-error.ts` — sliding-window math: `WINDOW_MS=10_000`, `THRESHOLD=3`; trip writes `autodisabled[id] = {reason, count, firstAt, lastAt}`, clears window, broadcasts.
- `apps/extension/src/background/handlers/experiment-error.test.ts` — 6 tests: 1st/2nd/3rd error in window, expiry reset, last_error always written, idempotent return shape.
- `apps/extension/src/background/handlers/who-am-i.ts` — pure function `handleWhoAmI({sender}) → {tabId}` with throw on missing `sender.tab.id`.
- `apps/extension/src/background/handlers/who-am-i.test.ts` — 3 tests: positive, throw on missing tab, throw on missing tab.id.

### Modified
- `apps/extension/src/shared/messages.ts` — REPLACED with `defineExtensionMessaging<ProtocolMap>()`; Phase 1 `isExtensionMessage` guard removed.
- `apps/extension/entrypoints/background.ts` — REWIRED with handler split + runStartupMigration + tabs.onRemoved + setAccessLevel.
- `apps/extension/entrypoints/content-isolated.content.ts` — minimal swap: `chrome.runtime.onMessage.addListener` → `onMessage('STATE_CHANGED', () => reconcile())`. Plan 02-07 (Wave 4) rewires fully.
- `apps/extension/src/test-setup/chrome-mock.ts` — added `runtime.id`, `runtime.getURL`, `storage.session.setAccessLevel`, `tabs.onRemoved`; module-load chrome assignment to satisfy webextension-polyfill's id check; vi.mock factory for `@webext-core/messaging` so handlers/broadcast use the live chrome mock per test.
- `apps/extension/src/content/error-isolation.test.ts` — last_error assertion updated for Phase 2 D-29 map shape (consolidated `last_error: Record<id, ErrorRecord>` instead of Phase 1 per-key `last_error:<id>`).
- `apps/extension/src/shared/storage.ts` — added Phase 2 helpers per RESEARCH §7 verbatim (`getLastErrors`, `setLastError`, `getAutoDisabled`, `setAutoDisable`, `clearAutoDisable`, `getErrorWindow`, `setErrorWindow`, `clearErrorWindow`, `getAppliedInTab`, `setAppliedInTab`, `runStartupMigration`); `recordLastError`/`clearLastError` Phase 1 forwarders rewritten to flow through the new map.
- `apps/extension/src/shared/storage.test.ts` — recordLastError/clearLastError tests updated for new map shape.
- `packages/experiment-sdk/src/index.ts` — added `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId()` (subset of Plan 02-01 D-30/D-31).
- `apps/extension/package.json`, `pnpm-lock.yaml` — `@webext-core/messaging@^2.3.0` installed.

## ProtocolMap Final Shape

```ts
export interface ProtocolMap {
  EXPERIMENT_TOGGLE(data: { id: string; enabled: boolean }): ToggleResult;
  STATE_CHANGED(data: { tabId: number }): void;          // R8 enrichment
  EXPERIMENT_ERROR(data: ErrorReport): { ok: true };
  STATUS_QUERY(): Record<string, ExperimentStatus>;
  WHO_AM_I(): WhoAmIResult;                              // Blocker 2 fix
}
```

## background.ts Ordering Verified

| # | Line | Element |
|---|------|---------|
| 1 | 25-30 | imports (handlers, onMessage, runStartupMigration) |
| 2 | 36 | `void runStartupMigration().catch(...)` — R7 BEFORE onMessage |
| 3 | 44 | `onMessage('EXPERIMENT_TOGGLE', ...)` |
| 4 | 45 | `onMessage('EXPERIMENT_ERROR', ...)` |
| 5 | 49 | `onMessage('WHO_AM_I', ...)` |
| 6 | 55 | `chrome.tabs.onRemoved.addListener(...)` |
| 7 | 60 | `defineBackground(() => { setAccessLevel(...) })` |

`awk '/runStartupMigration/{print NR}/onMessage..EXPERIMENT/{print NR}'` confirms migration line (36) < first onMessage line (44).

## Sliding-Window Correctness (Tested)

The 4 documented states each have a green test:

| State | Test | Outcome |
|-------|------|---------|
| 1st error in window | `1st error: opens window with count=1` | `error_window:X = {count:1, firstAt:1000}` |
| Within-window increment | `2nd error within 10s: count=2` | `error_window:X = {count:2, firstAt:1000}` (firstAt unchanged) |
| Trip at threshold | `3rd error within 10s: trips auto-disable + clears window + broadcasts` | `autodisabled.X = {reason:'≥3 errors in 10s', count:3, ...}`; `error_window:X` removed; STATE_CHANGED broadcast |
| Expiry reset | `error after window expiry: resets to count=1, firstAt=now` | `error_window:X = {count:1, firstAt:11000}`; `autodisabled` empty |

Plus `last_error[id]` is always written and `{ok: true}` is always returned.

## D-13 Recovery Branch Verified

- Test `clears autodisabled[id] and error_window:<id>` seeds both keys, calls `handleExperimentToggle({id:'X', enabled:true})`, asserts both cleared.
- Test `toggle OFF: writes enabled[id]=false; does NOT clear autodisabled` seeds autodisabled, toggles OFF, asserts autodisabled preserved (engine kill-switch persists across user-OFF until user-ON re-arms).

## WHO_AM_I Handler Shape Verified

- Pure function over a `{sender: chrome.runtime.MessageSender}` envelope; no chrome.* side effects.
- Test `returns {tabId} from envelope.sender.tab.id` — positive path.
- Test `throws when envelope.sender.tab is undefined` — popup / options call.
- Test `throws when envelope.sender.tab exists but has no id` — defensive edge case.

`@webext-core/messaging` propagates the throw to the calling content script as a rejected promise; the bootstrap callsite (Plan 02-07) decides whether to fall back to the STATE_CHANGED listener path.

## Decisions Made

See key-decisions in frontmatter — verbatim. The notable ones beyond the plan:

1. **Self-bootstrap wave-0 deps in a chore commit.** Wave-1 worktrees branched from b4398a3 before plans 02-01 and 02-02 had been merged; the orchestrator's merge step is expected to reconcile against sibling wave-0 outputs. Isolating the self-bootstrap in `0acc665` makes it trivial to identify and accept-theirs (or accept-ours-with-theirs) at merge time.
2. **Mock @webext-core/messaging in chrome-mock.ts (not per-test).** The real library wraps chrome via `webextension-polyfill` which caches a reference at module-eval time and ignores `vi.stubGlobal('chrome', newMock)` in beforeEach. Mocking the library factory once in the setupFile sidesteps this entirely; handler tests still call handlers directly per RESEARCH §9.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Self-bootstrapped Wave 0 dependencies (SDK types + storage helpers + @webext-core/messaging install)**
- **Found during:** Pre-execution baseline check.
- **Issue:** Wave-1 worktrees branch from b4398a3 (before Wave 0 plans 02-01 and 02-02 land). My plan declares `depends_on: [02-01, 02-02]` and references `ErrorRecord`/`ExperimentStatus` from `@platform/experiment-sdk` plus `setLastError`/`getErrorWindow`/`setErrorWindow`/`clearErrorWindow`/`setAutoDisable`/`clearAutoDisable`/`runStartupMigration` from `@/shared/storage` — none of which existed in the worktree base. Without them every task's typecheck and unit test would fail.
- **Fix:** Inlined the subset of Wave-0 contracts this plan references (RESEARCH §1.5 SDK types + RESEARCH §7 verbatim storage helpers + `pnpm add @webext-core/messaging`) in a dedicated `chore(02-03): inline wave-0 dependencies for parallel execution` commit (`0acc665`) so the orchestrator merge step can identify and resolve cleanly against sibling wave-0 worktrees.
- **Files modified:** packages/experiment-sdk/src/index.ts, apps/extension/src/shared/storage.ts, apps/extension/src/shared/storage.test.ts, apps/extension/package.json, pnpm-lock.yaml.
- **Verification:** `pnpm typecheck && pnpm test --run` both green after the chore commit; pre-existing 7 storage tests passed unchanged (forwarder behavior).
- **Committed in:** `0acc665`.

**2. [Rule 3 — Blocking] Extended chrome-mock for webextension-polyfill compatibility**
- **Found during:** Task 2 first GREEN attempt — `Error: This script should only be loaded in a browser extension` at the polyfill's module-eval-time `globalThis.chrome.runtime.id` check.
- **Issue:** `@webext-core/messaging` imports `webextension-polyfill@0.10.0` which throws if `globalThis.chrome.runtime.id` is undefined when the polyfill module first evaluates. Vitest's setupFile runs `beforeEach`-style hooks AFTER test-file module imports, so by the time the chrome mock was stubbed in beforeEach, the polyfill had already thrown.
- **Fix:** (a) Set `globalThis.chrome` and `globalThis.browser` at module-load time in chrome-mock.ts (before any `beforeEach`); (b) Add `runtime.id`, `runtime.getURL`, `storage.session.setAccessLevel`, `tabs.onRemoved` to the mock surface; (c) `vi.mock('@webext-core/messaging', ...)` in chrome-mock.ts so `sendMessage`/`onMessage` route through the live chrome mock per test (the polyfill caches its own chrome reference and ignores per-test stubGlobal swaps).
- **Files modified:** apps/extension/src/test-setup/chrome-mock.ts.
- **Verification:** All 47 tests pass after the fix; the new mock surface matches RESEARCH §9 expectations and is forward-compatible with Plan 02-02's chrome-mock extensions.
- **Committed in:** part of Task 2 GREEN commit.

**3. [Rule 1 — Bug] Updated error-isolation.test.ts for D-29 last_error map shape**
- **Found during:** Full-suite test run after Task 2 GREEN.
- **Issue:** Phase 1's `recordLastError` wrote `last_error:<id>` per-key strings; the inlined Plan 02-02 storage helpers consolidate to a single `last_error: Record<id, ErrorRecord>` map (D-29). The Phase 1 `error-isolation.test.ts` asserted the old per-key shape and failed.
- **Fix:** Updated assertion to read `last_error` map and pull out `[id]?.message`.
- **Files modified:** apps/extension/src/content/error-isolation.test.ts.
- **Verification:** Test now asserts the Phase 2 shape; passes alongside the 6 storage tests (which were already updated in the chore commit).
- **Committed in:** part of Task 2 GREEN commit.

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 bug — all surfaced by parallel-execution branch base)
**Impact on plan:** All deviations addressed parallel-execution mechanics, not plan scope. The 5 declared tasks executed exactly as specified. The plan special note (`isExtensionMessage` callsite update + minimal `content-isolated.content.ts` shape for Plan 02-07) was honored in the same task that swapped messages.ts (Task 1 GREEN commit).

## Issues Encountered

- **webextension-polyfill module-eval-time check** — see Deviation 2. Resolved by module-load chrome assignment + library mock in chrome-mock.ts; not a plan defect.
- Biome auto-fixes (organize-imports + line-collapse for short type unions) on 3 files after Task 5; trivial, applied via `biome check --write .`.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already documents (T-2-07..T-2-11, T-2-30). The WHO_AM_I handler reads `sender.tab.id` from the chrome IPC envelope, which is forge-resistant per Chrome (T-2-30 disposition `accept` is unchanged).

## User Setup Required

None — no external service configuration required by this plan.

## Next Phase Readiness

- ProtocolMap is locked; downstream plans 02-04 (registry.json), 02-05 (Zustand store), 02-06 (popup), 02-07 (content scripts), 02-08 (verification) can `import { sendMessage, onMessage } from '@/shared/messages'` against a stable surface.
- `handleExperimentError` sliding-window math is correctness-tested for the 4 documented window states; Plan 02-07 will exercise it end-to-end via the content-script error-reporting path.
- `WHO_AM_I` handler is wired and tested; Plan 02-07's content-script bootstrap can call `sendMessage('WHO_AM_I', undefined)` and write `applied:<tabId>` BEFORE the first STATE_CHANGED.
- `setAccessLevel` is in place inside `defineBackground` main; Plan 02-07's content-script writes to `chrome.storage.session` will succeed.

**Merge concerns for the orchestrator:**
- The chore commit `0acc665` writes `packages/experiment-sdk/src/index.ts`, `apps/extension/src/shared/storage.ts`, `apps/extension/src/shared/storage.test.ts`, `apps/extension/package.json`, `pnpm-lock.yaml`. These files are ALSO owned by Plans 02-01 and 02-02. At wave merge, prefer Plan 02-01's SDK and Plan 02-02's storage; my subset is a proper structural subset, so accept-theirs is safe. The `chore` commit also added `@webext-core/messaging` to apps/extension/package.json — Plan 02-02's `package.json` should already include it per its own truth list, so the dep line is a duplicate-add (resolve via accept-theirs or accept-ours; semantics are identical).
- The chrome-mock additions in commit `3addb7b` (Task 2 GREEN) are also Plan 02-02 territory. The mock surface I added (runtime.id, runtime.getURL, storage.session.setAccessLevel, tabs.onRemoved, @webext-core/messaging vi.mock factory) matches RESEARCH §9 verbatim; merge against Plan 02-02's chrome-mock should be a structural superset on either side, no conflict.

## Self-Check: PASSED

Verified post-summary creation:

```
$ git log --oneline | head -10  # confirm all commits exist
1343123 feat(02-03): rewire background.ts as typed orchestrator
493b163 feat(02-03): implement who-am-i handler (Blocker 2 fix)
01f27f3 test(02-03): add failing tests for who-am-i handler
b7fe10f feat(02-03): implement experiment-error sliding-window handler
37491d1 test(02-03): add failing tests for experiment-error sliding window
3addb7b feat(02-03): implement experiment-toggle handler + broadcast helper
2955269 test(02-03): add failing tests for experiment-toggle + broadcast
bed8018 feat(02-03): replace messages.ts with @webext-core/messaging ProtocolMap
74d0423 test(02-03): add ProtocolMap compile-only smoke test
0acc665 chore(02-03): inline wave-0 dependencies for parallel execution

$ pnpm typecheck && pnpm -F @platform/extension test --run && pnpm check-csp && pnpm lint
# all four green; 47 tests pass
```

Files exist:
- `apps/extension/src/shared/messages.ts`, `messages.test.ts` ✓
- `apps/extension/src/background/broadcast.ts` ✓
- `apps/extension/src/background/handlers/experiment-toggle.ts`, `experiment-toggle.test.ts` ✓
- `apps/extension/src/background/handlers/experiment-error.ts`, `experiment-error.test.ts` ✓
- `apps/extension/src/background/handlers/who-am-i.ts`, `who-am-i.test.ts` ✓
- `apps/extension/entrypoints/background.ts` rewritten ✓

Commits exist (10 commits, all hashes verified via `git log`).

---
*Phase: 02-state-foundation-messaging-popup-shell*
*Completed: 2026-04-25*
