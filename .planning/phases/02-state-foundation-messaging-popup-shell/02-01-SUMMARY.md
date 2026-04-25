---
phase: 02-state-foundation-messaging-popup-shell
plan: 01
subsystem: sdk

tags: [typescript, types, sdk, vitest, zod, ulid, registry]

# Dependency graph
requires:
  - phase: 01-foundation-spike-engine-skeleton
    provides: "@platform/experiment-sdk with ExperimentManifest (Zod) + ApplyArgs/ApplyFn/CleanupFn/Helpers/Tweak types"
provides:
  - "RegistryEntry, Registry, ExperimentStatus, ErrorRecord, AutoDisableRecord type-only exports"
  - "byId(registry, id) O(n) pure runtime helper"
  - "RegistryEntry.folder field — directory name under experiments/<author>/, used by content-script loader resolution (Warning 6 fix; eliminates fragile chunkPath regex)"
  - "Compile-time guarantees that Plan 02-04 build plugin must emit RegistryEntry literals with folder or fail typecheck (T-2-01 mitigation)"
affects:
  - "02-02 (chrome.storage helpers — types ErrorRecord/AutoDisableRecord/ExperimentStatus)"
  - "02-03 (SW message handlers — error reports, kill-switch records)"
  - "02-04 (build plugin emits registry.json — RegistryEntry shape lock)"
  - "02-05 (Zustand store — Registry/RegistryEntry/ExperimentStatus state shapes)"
  - "02-07 (content scripts — entry.folder for findLoader resolution; Registry filter by world+scope)"
  - "Phase 3 popup tweak rendering, Phase 4 helpers — all import from this SDK"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Type-only exports for cross-package contracts (zero-runtime SDK preserved per D-31; only byId + Zod schema have runtime cost)"
    - "Compile-time type-export assertion via const-literal-with-explicit-annotation pattern (manifest.test.ts compile-asserts all 5 new types)"

key-files:
  created:
    - "packages/experiment-sdk/src/registry.test.ts (4 vitest cases for byId; makeEntry fixture builder mirrors manifest.test.ts idiom)"
  modified:
    - "packages/experiment-sdk/src/index.ts (+64 lines — 5 type exports + byId function appended; Phase 1 exports preserved verbatim)"
    - "packages/experiment-sdk/src/manifest.test.ts (+37 lines — type-only imports + 5 compile-time const assertions; Phase 1's 14 describe/it blocks preserved verbatim)"

key-decisions:
  - "RegistryEntry.folder is a required string (not optional). Build plugin (Plan 02-04) MUST emit it; content scripts (Plan 02-07) MUST read entry.folder for loader resolution. This is the Warning 6 fix from checker iteration 1 — makes the type system enforce a previously fragile regex-based contract."
  - "byId implemented via Array.prototype.find (O(n)). With ~10–50 registry entries expected, this is fine; Phase 3+ may swap to Map<id, RegistryEntry> if registry sizes grow."
  - "byId returns the FIRST matching entry on duplicate ids (defensive — registry should be unique by build-time validation, but byId is forgiving rather than throwing). Documented and tested."
  - "ExperimentStatus is a const string-union (5 states from D-08), not an enum — keeps type-only export, no runtime emission."
  - "ErrorRecord.stack is optional (some errors lack stacks); message/phase/at are required. T-2-02 disposition: stack traces stay in chrome.storage.local (per-user device); never wired to network."

patterns-established:
  - "SDK additivity: Phase 2 only APPENDS exports to packages/experiment-sdk/src/index.ts; never modifies Phase 1 exports. Verifiable via grep on '^export const ExperimentManifest' / '^export type ApplyFn' (still present, unchanged)."
  - "Test-file pattern lock from 02-PATTERNS.md Group A: registry.test.ts mirrors manifest.test.ts (vitest, describe-per-concern, positive/negative split, inline fixture builder)."
  - "Compile-time type-export assertion: const literals with explicit annotations (e.g. `const _entryOk: RegistryEntry = {...}`) double as runtime no-ops AND compile gates — if any of the 5 new types disappears or changes shape, manifest.test.ts fails typecheck."

requirements-completed: [MAN-04, MAN-03]

# Metrics
duration: 3min2s
completed: 2026-04-25
---

# Phase 02 Plan 01: SDK Type Foundation Summary

**5 type-only exports (RegistryEntry, Registry, ExperimentStatus, ErrorRecord, AutoDisableRecord) + byId helper added to @platform/experiment-sdk; locks the contract every Phase 2 plan imports BEFORE those plans land. Closes MAN-04. Adds RegistryEntry.folder field (Warning 6 fix) so content-script loader resolution reads a typed field instead of regex-parsing chunkPath.**

## Performance

- **Duration:** 3min2s
- **Started:** 2026-04-25T21:45:34Z
- **Completed:** 2026-04-25T21:48:36Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- 5 new type-only exports (RegistryEntry, Registry, ExperimentStatus, ErrorRecord, AutoDisableRecord) shipped in `packages/experiment-sdk/src/index.ts` per D-30 verbatim, with the additional `folder: string` field on RegistryEntry per checker iteration 1 Warning 6.
- 1 new pure runtime helper `byId(registry, id): RegistryEntry | undefined` (~5 lines) implemented and tested with 4 vitest cases (empty, match, multiple-match returns first, no-match).
- Phase 1 exports (`ExperimentManifest`, `Helpers`, `Tweak`, `ApplyArgs`, `CleanupFn`, `ApplyFn`) preserved verbatim — zero breaking changes.
- `manifest.test.ts` extended with type-only import + 5 const-literal compile-time assertions; Phase 1's 14 manifest schema tests preserved verbatim.
- Full test suite: 18 tests passing across 2 files (14 Phase 1 + 4 new). Root `tsc -b --pretty` typecheck clean.
- T-2-01 (RegistryEntry shape drift) mitigation in place: build plugin (Plan 02-04) cannot emit a RegistryEntry literal without `folder` or it fails typecheck.

## Task Commits

Each task was committed atomically (per-task feat/test commits):

1. **Task 1: Add 5 type exports + byId helper to experiment-sdk** — `5b21e8d` (feat)
2. **Task 2: Add registry.test.ts with byId positive/negative/empty cases** — `e2faa85` (test)
3. **Task 3: Extend manifest.test.ts with compile-time imports of 5 new SDK types** — `44dee59` (test)

_Note: This plan's TDD profile is unusual — Task 1 ships the implementation, Task 2 ships the unit tests for it (RED was implicit: the test file didn't exist), Task 3 ships compile-time assertions. Per the plan's explicit task ordering, the GREEN phase is Task 2 (creates+passes registry.test.ts), and the implementation gate is Task 1 (without it, Task 2 won't typecheck)._

## Final Type Signatures (verbatim, as exported)

```ts
// ===== Phase 2 additions (D-30, D-31) =====

export type RegistryEntry = {
  id: string;            // ULID Crockford base32 (26 chars), validated at build (Phase 1 D-17)
  author: string;        // matches folder name's parent dir, enforced by build plugin (Phase 1 D-18)
  folder: string;        // directory name under experiments/<author>/ — emitted by build plugin (Plan 02-04). Used by content-script findLoader to resolve the build-time chunk loader (Warning 6 fix; eliminates the chunkPath regex parse).
  name: string;
  description: string;
  scope: { match: string[]; regex?: string[] };
  world: 'isolated' | 'main';
  chunkPath: string;     // relative to extension root, e.g. "chunks/experiments-andrew__smoke-DkJ7g.js" or '' if inlined
  tweaks: unknown[];     // opaque in Phase 2; Phase 3 narrows via discriminated union
};

export type Registry = RegistryEntry[];

export type ExperimentStatus = 'disabled' | 'pending' | 'applied' | 'error' | 'auto-disabled';

export type ErrorRecord = {
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
  at: number;            // Date.now() millis
};

export type AutoDisableRecord = {
  reason: string;        // e.g. "≥3 errors in 10s"
  count: number;         // number of errors when the breaker tripped
  firstAt: number;       // window start, Date.now() millis
  lastAt: number;        // most recent error inside the trip window, Date.now() millis
};

export function byId(registry: Registry, id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}
```

### Notes on `folder: string` (Warning 6 fix)

This is the only field-level deviation from D-30's original 8-field RegistryEntry shape; Phase 2 ships with 9 fields. Documented rationale:
- Plan 02-07 content scripts will resolve build-time chunk loaders by directory name. Without `folder`, the resolution path is regex-parsing `chunkPath` (e.g. `experiments-[^-]+-([^-]+)-`), which breaks when author or folder names contain hyphens.
- The build plugin (Plan 02-04) emits the folder name anyway (it walks `experiments/<author>/<folder>/manifest.json` to discover entries), so making it a typed field is zero marginal cost on the producer side.
- Compile-time enforced: any Plan 02-04 RegistryEntry literal omitting `folder` will fail `tsc -b`.

### Notes on `byId` complexity

- O(n) via `Array.prototype.find` — ~5 lines per D-31.
- Expected registry size for v1: ~10–50 entries (one closed team, ~3 designers × ~3–10 experiments each).
- Phase 3+ may swap to a `Map<id, RegistryEntry>` if registry sizes grow past ~hundreds, but premature optimization here is rejected per zero-runtime-SDK principle (D-31).
- Defensive behavior on duplicate ids: returns the first match (rather than throwing). Tested explicitly. Build-time validation is the source of truth for uniqueness.

## Files Created/Modified

- `packages/experiment-sdk/src/index.ts` — Added 64 lines (5 type exports + byId function) appended after Phase 1 exports.
- `packages/experiment-sdk/src/registry.test.ts` — Created (44 lines): vitest describe('byId') with 4 it() blocks, makeEntry fixture builder.
- `packages/experiment-sdk/src/manifest.test.ts` — Added 37 lines (compile-time import block + 5 const literal assertions); Phase 1's 14 describe/it blocks untouched.

## Decisions Made

See `key-decisions` in frontmatter (5 decisions logged for STATE.md extraction).

## Deviations from Plan

The plan's `<verify>` blocks specified:
- `pnpm --filter @platform/experiment-sdk typecheck` (Task 1, Task 3)
- `pnpm --filter @platform/experiment-sdk vitest run src/registry.test.ts` (Task 2)
- `pnpm --filter @platform/experiment-sdk vitest run src/manifest.test.ts` (Task 3)

Neither `typecheck` nor `vitest` exist as scripts in `packages/experiment-sdk/package.json` (only `build` and `test`). Substituted equivalent commands:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Substituted typecheck/vitest commands with equivalents that exist in this monorepo**
- **Found during:** Task 1 (verify step)
- **Issue:** Plan's `<verify>` block referenced scripts (`typecheck`, `vitest`) that don't exist in `packages/experiment-sdk/package.json`. The package only declares `build` (`tsc -b`) and `test` (`vitest`). Running the plan's commands fails with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.
- **Fix:** Used the equivalent root-level/passthrough commands:
    - `pnpm typecheck` (root script: `tsc -b --pretty`) — covers `@platform/experiment-sdk` because it's part of the project's TS composite build.
    - `pnpm --filter @platform/experiment-sdk test --run <path>` — passes `--run <path>` to the package's `test` script (`vitest`), which is functionally identical to `vitest run <path>`.
- **Files modified:** None (verification commands only — not committed code).
- **Verification:** Both substituted commands exit 0; full vitest suite reports `Test Files  2 passed (2) | Tests  18 passed (18)`. Root typecheck clean.
- **Committed in:** N/A (verification-only deviation, no code change).

### Expected Deviations (anticipated by plan)

**2. [Plan-anticipated] `folder: string` added to RegistryEntry**
- **Found during:** Task 1 (already specified in plan's `<action>` block per checker iteration 1 Warning 6).
- **Issue:** D-30's original RegistryEntry had 8 fields; Phase 2 ships 9 (adds `folder`).
- **Fix:** Field added per plan's verbatim spec; fixtures in registry.test.ts (`makeEntry`) and manifest.test.ts (`_entryOk`) both include `folder`.
- **Verification:** `grep -E "folder: string" packages/experiment-sdk/src/index.ts` returns 1 line; `folder: 'fixture'` in registry.test.ts; `folder: 'a'` in manifest.test.ts.
- **Committed in:** `5b21e8d` (Task 1), `e2faa85` (Task 2), `44dee59` (Task 3).

This is not a real deviation — the plan documented this addition explicitly and the `<output>` block lists it as the only expected deviation. Logged here for completeness.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking script substitution; verification-only, no code change), 1 plan-anticipated (folder field).
**Impact on plan:** Zero scope creep. The script substitution is purely cosmetic — equivalent commands ran with identical semantics. The folder field was explicitly specified in the plan's `<action>` block.

## Issues Encountered

- **Plan-referenced npm scripts didn't exist** — see Deviation #1 above. Resolved by substituting equivalent commands. Future Phase 2 plans should reference `pnpm typecheck` (root) or `pnpm --filter <pkg> test --run <path>` instead of non-existent `typecheck` / `vitest` package scripts. Recommend adding a `typecheck` script to each package's `package.json` (`"typecheck": "tsc -b --pretty"`) in a future infra plan if Plan 02-02+ encounter the same issue.

## Confirmation of Final Verification

- `pnpm typecheck` — exits 0 (`tsc -b --pretty` clean across the project, no errors).
- `pnpm --filter @platform/experiment-sdk test --run` — exits 0 (`Test Files 2 passed (2) | Tests 18 passed (18)` — 14 Phase 1 manifest tests + 4 new byId tests).
- All 9 grep-based acceptance criteria for Task 1 pass.
- All 4 acceptance criteria for Task 2 pass (file exists, describe count=1, it count=4, folder fixture present).
- All 3 acceptance criteria for Task 3 pass (import block, 11 type-name occurrences ≥10, folder: 'a' literal).

## Threat Surface Scan

No new security-relevant surface introduced beyond the plan's `<threat_model>`. Type-only exports have no runtime attack surface; `byId` is a pure function over typed inputs.

T-2-01 (Tampering — RegistryEntry shape drift) — mitigation in place via TS compile-time enforcement. Documented in patterns-established.
T-2-02 (Information Disclosure — ErrorRecord.stack) — accept disposition unchanged; stack traces remain local-only.
T-2-03 (Repudiation — AutoDisableRecord without source attribution) — accept disposition unchanged; sole producer is SW handler in Plan 02-03.

No `threat_flag` entries — no out-of-scope security surface emerged during execution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 2 SDK contract locked. Plans 02-02 (storage), 02-03 (SW messaging), 02-04 (build plugin emits registry.json), 02-05 (Zustand store), 02-07 (content scripts) can now `import type { RegistryEntry, Registry, ExperimentStatus, ErrorRecord, AutoDisableRecord } from '@platform/experiment-sdk'` and get full Cursor autocomplete (MAN-04). The `folder` field on RegistryEntry is mandatory and will surface as a typecheck failure in any downstream plan that omits it — exactly the desired contract enforcement.

No blockers, no concerns.

## Self-Check: PASSED

- `packages/experiment-sdk/src/index.ts` — FOUND (modified, +64 lines).
- `packages/experiment-sdk/src/registry.test.ts` — FOUND (created, 44 lines, 4 tests passing).
- `packages/experiment-sdk/src/manifest.test.ts` — FOUND (modified, +37 lines, 14 Phase 1 tests still passing).
- Commit `5b21e8d` (Task 1) — FOUND in `git log`.
- Commit `e2faa85` (Task 2) — FOUND in `git log`.
- Commit `44dee59` (Task 3) — FOUND in `git log`.
- Root `pnpm typecheck` — exits 0.
- `pnpm --filter @platform/experiment-sdk test --run` — exits 0, 18/18 tests passing.

---
*Phase: 02-state-foundation-messaging-popup-shell*
*Plan: 01*
*Completed: 2026-04-25*
