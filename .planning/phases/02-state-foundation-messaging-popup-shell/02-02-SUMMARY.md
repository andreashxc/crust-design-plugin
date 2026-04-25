---
phase: 02-state-foundation-messaging-popup-shell
plan: 02
subsystem: testing
tags: [storage, chrome-storage, vitest, jsdom, rtl, zustand, webext-core, ulid, migration]

# Dependency graph
requires:
  - phase: 01-foundation-spike-engine-skeleton
    provides: Phase 1 storage helpers (getEnabledExperiments / setEnabledExperiment / recordLastError / clearLastError), chrome-mock with storage.local + storage.session areas, vitest extension config
  - plan: 02-01
    provides: ErrorRecord + AutoDisableRecord type-only exports from @platform/experiment-sdk (added in this worktree as a Rule 3 blocking-issue mitigation; converges with 02-01's identical block on merge)
provides:
  - 11 new typed storage helpers for Phase 2 keys (last_error map, autodisabled map, error_window:<id>, applied:<tabId>)
  - Idempotent runStartupMigration (D-29) with _migrations audit-key gating
  - Extended chrome-mock: storage.onChanged with fireChange routing, storage.session.setAccessLevel, runtime.getURL, tabs.onRemoved
  - Widened vitest include: discovers entrypoints/**/*.test.tsx for popup React tests
  - 5 new external dependencies pinned (@webext-core/messaging, zustand, @testing-library/react, @testing-library/jest-dom, jsdom)
affects: [02-03 (SW handlers consume helpers + onChanged), 02-04 (registry build plugin), 02-05 (Zustand popup store), 02-06 (RTL popup tests need jsdom + entrypoints discovery), 02-07 (content scripts use applied:<tabId> + setAccessLevel)]

# Tech tracking
tech-stack:
  added:
    - "@webext-core/messaging ^2.3.0 (typed onMessage routing)"
    - "zustand ^5.0.12 (popup state store)"
    - "@testing-library/react ^16.3.2 (popup component tests)"
    - "@testing-library/jest-dom ^6.9.1 (DOM matchers)"
    - "jsdom ^29.0.2 (per-file vitest environment opt-in)"
  patterns:
    - "Storage helpers: KEY_* constants top-of-file, async + typed signatures, runtime guard `typeof v === 'object' && !Array.isArray(v)` against malformed values, no module-scope state, no caching"
    - "Migration idempotency: gate every migration on a string in `_migrations` array; first run does work + appends marker; subsequent runs early-return"
    - "chrome-mock per-instance listener registry: fresh per beforeEach (since whole mock is rebuilt) → tests cannot leak listeners across the suite"
    - "Vitest env strategy: `environment: 'node'` global default (fast for pure-logic), per-file `// @vitest-environment jsdom` pragma for DOM tests"

key-files:
  created: []
  modified:
    - "apps/extension/src/shared/storage.ts (Phase 1 4 exports + 11 new helpers + runStartupMigration)"
    - "apps/extension/src/shared/storage.test.ts (Phase 1 7 tests + 16 new tests = 23 total)"
    - "apps/extension/src/test-setup/chrome-mock.ts (added onChanged registry, fireChange wiring, setAccessLevel, getURL, onRemoved)"
    - "apps/extension/vitest.config.ts (widened include, added jsdom env opt-in comment)"
    - "apps/extension/package.json (5 new deps)"
    - "pnpm-lock.yaml (workspace root lockfile sync)"
    - "packages/experiment-sdk/src/index.ts (Phase 2 SDK types added in this worktree as cross-worktree dep mitigation; converges with 02-01)"

key-decisions:
  - "Plan 02-02: Reproduce 02-01's exact additive SDK block byte-for-byte in this worktree to make typecheck/tests pass independently — avoids blocking on cross-worktree wave-0 ordering. Identical content → git auto-merges cleanly regardless of which worktree merges first."
  - "Plan 02-02: chrome-mock fireChange fires AFTER state mutation (set/remove/clear apply changes first, then dispatch listeners) — matches chrome.storage.onChanged real-world ordering."
  - "Plan 02-02: `clearLastError` (Phase 1, removes per-key) and `clearLastErrorMap` (Phase 2, removes from consolidated map) both kept side by side — Phase 1 callers (recordLastError forwarder) still work; Phase 2 callers use the map version. Migration converts old per-keys to the map shape one-way."
  - "Plan 02-02: Vitest 4 dropped the `basic` reporter — running `vitest run` (default reporter) instead of `--reporter=basic` from plan's verify command. Default verbose reporter is acceptable for CI parity (Phase 1 vitest config uses no reporter override)."

patterns-established:
  - "11 helpers + 1 migration in storage.ts establish the canonical Phase 2 storage surface: every downstream Phase 2 plan (02-03/04/05/06/07) imports these helpers without going through chrome.storage directly"
  - "chrome-mock fireChange pattern: per-mock change listener array + `fireChange(changes, areaName)` after mutation; the same shape will scale to onMessage tests (Plan 02-03) and tabs.onRemoved tests (Plan 02-03 SW per-tab cleanup)"
  - "ULID-keyed storage assertion test (MAN-03): stores under ULID, reads under same ULID, no folder argument anywhere — codifies that helpers are immune to designer folder renames"

requirements-completed:
  - MAN-03
  - ENG-06

# Metrics
duration: 14min
completed: 2026-04-25
---

# Phase 02 Plan 02: Storage Helpers, Migration, Test Infrastructure Summary

**11 typed storage helpers (last_error map, autodisabled map, error_window:<id>, applied:<tabId>) + idempotent runStartupMigration + chrome-mock extensions (onChanged/setAccessLevel/getURL/tabs.onRemoved) + 5 new deps (@webext-core/messaging, zustand, RTL/jsdom) — Wave 0 contract floor for Phase 2.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-25T21:42:00Z (approx — branch base check)
- **Completed:** 2026-04-25T21:55:56Z
- **Tasks:** 5
- **Files modified:** 7 (5 in apps/extension + 1 SDK + 1 lockfile)

## Accomplishments

- **Storage contract floor (D-09 / D-12 / D-28 / D-29).** 11 typed helpers cover every Phase 2 storage key shape — `last_error` map, `autodisabled` map, `error_window:<id>` sliding window, `applied:<tabId>` per-tab applied set. Every helper async, typed, runtime-guarded against malformed values, zero module-scope state.
- **D-29 idempotent migration.** `runStartupMigration` consolidates Phase 1 per-key `last_error:<id>` entries into the new `last_error` map, gated by a `_migrations: string[]` audit-key (`last_error_to_map_v1` marker). Tests cover first-run, second-run no-op, and empty-store cases.
- **chrome-mock extensions.** `storage.onChanged` with per-instance change-listener registry routes `(changes, areaName)` correctly on every set/remove/clear. `storage.session.setAccessLevel`, `runtime.getURL`, `tabs.onRemoved` mocks unblock Plans 02-03 (SW), 02-06 (popup), and 02-07 (content scripts).
- **Vitest discovery widened.** `entrypoints/**/*.test.tsx` now picked up so Plan 02-06's RTL tests run alongside `src/`. `environment: 'node'` stays the global default (fast pure-logic baseline); jsdom is per-file pragma opt-in.
- **5 new deps pinned.** `@webext-core/messaging ^2.3.0`, `zustand ^5.0.12`, `@testing-library/react ^16.3.2`, `@testing-library/jest-dom ^6.9.1`, `jsdom ^29.0.2`. Frozen install verified.

## Task Commits

Each task was committed atomically (with `--no-verify` per parallel-execution protocol):

1. **Task 1: Install deps** — `f6cbdc8` (chore)
2. **Task 2: Extend chrome-mock** — `4d708e4` (feat)
3. **Task 3 (deviation): Add Phase 2 SDK types ahead of 02-01 merge** — `17b20a0` (chore — Rule 3 cross-worktree mitigation)
4. **Task 3: Add 11 storage helpers + runStartupMigration** — `865f347` (feat)
5. **Task 4: Extend storage.test.ts** — `3365042` (test)
6. **Task 5: Update vitest.config.ts** — `006183d` (chore)

**Plan metadata commit:** appended after self-check.

_Note: Task 3 produced two commits — the SDK type addition (Rule 3 deviation) and the storage helpers — to keep the deviation surgically isolated for review._

## Files Created/Modified

- `apps/extension/src/shared/storage.ts` — Phase 1 4 exports preserved; 11 new exports + `runStartupMigration` appended. KEY_* constants at top, async/typed/guarded throughout.
- `apps/extension/src/shared/storage.test.ts` — Phase 1 7 cases preserved; 16 new cases across last_error map / autodisabled map / error_window / applied / migration / ULID-rename safety. **23 tests total, all green.**
- `apps/extension/src/test-setup/chrome-mock.ts` — Phase 1 mock contract preserved (`vi.stubGlobal('chrome', makeChromeMock())` per beforeEach); added per-instance listener registry, fireChange wiring, setAccessLevel/getURL/onRemoved.
- `apps/extension/vitest.config.ts` — `include` widened to four globs; `environment: 'node'` kept as default with explanatory comment for the per-file `@vitest-environment jsdom` pragma convention.
- `apps/extension/package.json` — 5 new deps added; alphabetized blocks preserved.
- `pnpm-lock.yaml` — workspace root lockfile updated; expected merge collision with sibling plans 02-03 / 02-05 will be resolved by orchestrator's main-wins logic.
- `packages/experiment-sdk/src/index.ts` — Phase 2 SDK types (RegistryEntry / Registry / ExperimentStatus / ErrorRecord / AutoDisableRecord / byId) added preemptively (see Deviations).

## Decisions Made

- **Pinned versions** (per Phase 1 SP-6: record exact resolved versions, no range bumps): `@webext-core/messaging@^2.3.0`, `zustand@^5.0.12`, `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1`, `jsdom@^29.0.2`. No shadcn-related deps installed (deferred to Plan 02-05).
- **Migration idempotency contract**: `_migrations: string[]` audit array stored in `chrome.storage.local`. Migration name `last_error_to_map_v1` appended on first successful run; subsequent runs early-return on `done.includes(MIGRATION_NAME)`. Empty-store path also stamps the marker (avoids re-scanning chrome.storage on every SW boot for stores that never had Phase 1 data).
- **chrome-mock fireChange ordering**: changes computed from `data` BEFORE mutation, then `data` mutated, then `fireChange(changes, areaName)` dispatched — matches real chrome.storage.onChanged semantics where listeners see the new state after the write completes.
- **No deviations from D-28 / D-29 storage-key shapes** — keys are LOCKED per CONTEXT.md and were used verbatim: `enabled`, `last_error`, `autodisabled`, `error_window:<id>`, `applied:<tabId>`, `_migrations`.
- **vitest global env stayed `node`** per RESEARCH §14 Claude's Discretion — flag if Plan 02-06 later flips to global jsdom (it should not; the per-file pragma model scales better as the test count grows).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Added Phase 2 SDK types to packages/experiment-sdk/src/index.ts ahead of Plan 02-01 merge**

- **Found during:** Task 3 (storage.ts compile fails with TS2305: Module '@platform/experiment-sdk' has no exported member 'ErrorRecord' / 'AutoDisableRecord').
- **Issue:** Plan 02-02 declares `depends_on: [02-01]` but both plans run in Wave 0 in parallel worktrees. Plan 02-01 owns SDK src/index.ts but its worktree has not yet completed/merged. Without those types, this worktree's `tsc --noEmit` and the storage tests cannot compile.
- **Fix:** Reproduced Plan 02-01's additive SDK block byte-for-byte (RegistryEntry / Registry / ExperimentStatus / ErrorRecord / AutoDisableRecord / byId) — verbatim D-30 + D-31 spec from 02-01-PLAN.md. Block placed at bottom of `packages/experiment-sdk/src/index.ts`; Phase 1 exports above untouched.
- **Files modified:** `packages/experiment-sdk/src/index.ts` (additive block only).
- **Verification:** `pnpm -F @platform/extension exec tsc --noEmit` passes; `pnpm -F @platform/extension exec vitest run` passes 44/44 tests including all 23 storage tests.
- **Committed in:** `17b20a0` (chore commit, separated from the storage feat commit `865f347` for surgical-review isolation).
- **Merge-time behavior:** When 02-01's worktree merges first, git sees identical content and auto-resolves cleanly. When this worktree merges first, 02-01's later merge will produce the same block — also idempotent. The orchestrator's main-wins logic for any residual conflict still applies.

---

**Total deviations:** 1 auto-fixed (Rule 3 cross-worktree dependency mitigation).
**Impact on plan:** Necessary for this worktree to typecheck and run tests independently. Zero scope creep — the SDK addition is exactly what 02-01 will produce.

## Issues Encountered

- **Vitest 4 dropped the `basic` reporter.** Plan's verify command included `--reporter=basic` which throws `Failed to load custom Reporter from basic`. Switched to default reporter (`vitest run` with no flag) — same coverage, parses cleanly. Documented in Decisions Made.
- **pnpm engine warning** (`wanted: node>=24.0.0, current: v22.16.0`) is informational only; build/test all pass under v22. Not blocking.

## Stub tracking

No stubs introduced. Every helper has a real implementation backed by chrome.storage; every test has real assertions. The "ULID-keyed storage survives folder rename" test is intentionally a structural assertion (helpers don't take a folder argument) since the folder rename is a filesystem-level event untestable inside vitest — this is a verification-by-construction, not a stub.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 02-03 (SW handlers)** can now import every Phase 2 storage helper, register `chrome.storage.onChanged` listeners against the mock, register `tabs.onRemoved` for per-tab session cleanup (T-2-06 mitigation), and call `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` at SW startup. **Critical ordering reminder (RESEARCH R7): SW must call `runStartupMigration()` BEFORE registering onMessage handlers** — Plan 02-03 owns this wiring.
- **Plan 02-05 (Zustand popup store)** has zustand installed and ready. Same lockfile collision pattern applies (orchestrator handles).
- **Plan 02-06 (RTL popup tests)** has @testing-library/react, @testing-library/jest-dom, jsdom installed; vitest discovers `entrypoints/**/*.test.tsx`; tests use `// @vitest-environment jsdom` per-file pragma.
- **Plan 02-07 (content scripts)** can read/write `applied:<tabId>` via `getAppliedInTab` / `setAppliedInTab`. The `setAccessLevel` mock unblocks the full SW→content-script storage.session handshake test path.

**Concerns:** None. The cross-worktree SDK type addition is intentional and idempotent; the orchestrator merge model handles it.

---
*Phase: 02-state-foundation-messaging-popup-shell*
*Completed: 2026-04-25*

## Self-Check: PASSED

All claimed files exist on disk:
- apps/extension/src/shared/storage.ts (modified)
- apps/extension/src/shared/storage.test.ts (modified)
- apps/extension/src/test-setup/chrome-mock.ts (modified)
- apps/extension/vitest.config.ts (modified)
- apps/extension/package.json (modified)
- pnpm-lock.yaml (modified)
- packages/experiment-sdk/src/index.ts (modified — Rule 3 deviation)
- .planning/phases/02-state-foundation-messaging-popup-shell/02-02-SUMMARY.md (this file)

All claimed commits exist in git log:
- f6cbdc8 (Task 1)
- 4d708e4 (Task 2)
- 17b20a0 (Task 3 — Rule 3 SDK fix)
- 865f347 (Task 3 — storage helpers)
- 3365042 (Task 4)
- 006183d (Task 5)

Verification commands all green:
- `pnpm -F @platform/extension install --frozen-lockfile`: exit 0
- `pnpm -F @platform/extension exec tsc --noEmit`: exit 0
- `pnpm -F @platform/extension exec vitest run`: 4 files, 44/44 tests passed
