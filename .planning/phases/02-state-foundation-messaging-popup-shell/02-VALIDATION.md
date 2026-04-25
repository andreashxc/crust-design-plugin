---
phase: 02
slug: state-foundation-messaging-popup-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
# Per Warning 9 fix (checker iteration 1): wave_0_complete now means "all SDK +
# storage + chrome-mock + popup-pure-helpers Wave 0 infra exists" — the
# previously misclassified content-script TDD tests (contract.test.ts +
# abort-signal.test.ts) are tracked under "## Wave 4 Co-Located TDD Tests".
wave_4_co_located_tdd_complete: false
created: 2026-04-25
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `02-RESEARCH.md` §12 (Validation Architecture) and §14 (Files to Create / Modify).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (already pinned via Phase 1) |
| **Config file** | `apps/extension/vitest.config.ts` (Phase 1) + `packages/experiment-sdk/vitest.config.ts` + `tools/vitest.config.ts` |
| **Quick run command** | `pnpm test --run --changed` |
| **Full suite command** | `pnpm test --run && pnpm typecheck && pnpm lint && pnpm check-csp && pnpm build` |
| **Estimated runtime** | ~30 seconds for unit; +10 seconds for `pnpm build` |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --changed`
- **After every plan wave:** Run `pnpm test --run && pnpm typecheck && pnpm check-csp`
- **Before `/gsd-verify-work`:** Full suite must be green AND `apps/extension/.output/chrome-mv3/registry.json` must exist with all 9 schema fields (`id, author, folder, name, description, scope, world, chunkPath, tweaks`)
- **Max feedback latency:** 30 seconds (per-package `vitest --run`)

---

## Per-Task Verification Map

> Task IDs follow the pattern `{phase}-{plan}-{task}`. Plan/wave numbers are placeholders the planner fills in; the requirement → behavior → test mapping is locked.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-XX-XX | TBD | 0 | ENG-04 | — | `apply({tweaks, helpers, currentURL, log, signal}) → cleanup` contract enforced at compile time | TS-only | `pnpm typecheck` (deliberate `// @ts-expect-error` violations) | ❌ W0 (`apps/extension/src/content/contract.test.ts`) | ⬜ pending |
| 02-XX-XX | TBD | 1 | ENG-04 | — | AbortSignal honored on cleanup; `AbortError` from cleanup NOT counted as failure | unit | `pnpm vitest run apps/extension/src/content/abort-signal.test.ts` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 1 | ENG-06 | T-2-01 (auto-disable bypass) | Sliding-window error counter increments / resets / trips at ≥3 in 10s | unit | `pnpm vitest run apps/extension/src/background/handlers/experiment-error.test.ts` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 1 | ENG-06 | T-2-01 | Toggle OFF→ON clears `autodisabled:<id>` + `error_window:<id>` | unit | `pnpm vitest run apps/extension/src/background/handlers/experiment-toggle.test.ts -t recovery` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 4 | ENG-06 | T-2-01 | Reconcile filters out auto-disabled IDs even when `enabled[id]=true` | unit | `pnpm vitest run apps/extension/src/content/engine.test.ts -t auto-disabled` | ❌ W0 (extends Phase 1 file) | ⬜ pending |
| 02-XX-XX | TBD | 0 | MAN-03 | — | ULID-keyed storage survives folder rename (storage keys use ULID, not path) | unit | `pnpm vitest run apps/extension/src/shared/storage.test.ts -t rename` | ❌ W0 (extends Phase 1 file) | ⬜ pending |
| 02-XX-XX | TBD | 0 | MAN-04 | — | SDK exports `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId` | unit | `pnpm vitest run packages/experiment-sdk/src/registry.test.ts` + `pnpm typecheck` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 2 | BLD-03 | — | `dist/registry.json` emitted with `[id, author, folder, name, description, scope, world, chunkPath, tweaks]` (9 fields) | build-output | `pnpm build && node -e "JSON.parse(require('fs').readFileSync('apps/extension/.output/chrome-mv3/registry.json'))"` + `pnpm vitest run tools/build-experiments.test.ts -t registry` | ❌ W0 (extends Phase 1 file) | ⬜ pending |
| 02-XX-XX | TBD | 2 | BLD-04 | — | One code-split chunk per experiment in built output (`manualChunks` forces split) | build-output | `pnpm vitest run tools/build-experiments.test.ts -t chunks` (programmatic Vite build with fixture experiments) | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 3 | UI-01 | — | Popup renders shadcn `Switch / Card / Collapsible / Badge / ScrollArea / Button`; Tailwind v4 + React 19 | unit (jsdom + RTL) + manual smoke | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx -t shadcn-shell` | ❌ W0 (also `pnpm add -D @testing-library/react @testing-library/jest-dom jsdom`) | ⬜ pending |
| 02-XX-XX | TBD | 3 | UI-03 | — | Authors grouped alphabetically (case-insensitive); group label `{author} ({n})` shows total experiment count | unit | `pnpm vitest run apps/extension/src/popup/grouping.test.ts` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 3 | UI-04 | — | Toggle dispatches `EXPERIMENT_TOGGLE`; status badge reflects all 5 states (`disabled`, `pending`, `applied`, `error`, `auto-disabled`) with correct label + variant | unit (RTL) + manual smoke | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx -t status-states` + `pnpm vitest run apps/extension/src/popup/status.test.ts` | ❌ W0 | ⬜ pending |
| 02-XX-XX | TBD | 3 | UI-08 | — | Error short message visible; `▶ Show stack trace` expands inline; auto-disable adds `Disabled after {count} errors in {windowSec}s — toggle off/on to re-enable.` line | unit (RTL) | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx -t error-stack` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test infrastructure that MUST exist before any implementation task in Waves 1-5 lands. Sourced from `02-RESEARCH.md` §12 "Wave 0 Gaps".
>
> Warning 9 fix (checker iteration 1): `apps/extension/src/content/contract.test.ts` and `apps/extension/src/content/abort-signal.test.ts` were originally listed under Wave 0 but are co-located TDD tests that ship alongside the content-script implementation in Plan 02-07 (Wave 4). They are now classified as Wave 4 — see the `## Wave 4 Co-Located TDD Tests` section below.

- [ ] `apps/extension/src/background/handlers/experiment-error.test.ts` — sliding-window math (≥3 errors in 10s window; reset on first error after window expiry)
- [ ] `apps/extension/src/background/handlers/experiment-toggle.test.ts` — recovery (clears autodisabled + window) + broadcast (sends `STATE_CHANGED` to all matching tabs)
- [ ] `apps/extension/src/content/engine.test.ts` — extend Phase 1 with `auto-disabled` filter assertion
- [ ] `apps/extension/src/shared/storage.test.ts` — extend Phase 1 with auto-disabled, error-window, applied-in-tab, last-error map, migration idempotency, ULID-rename safety
- [ ] `apps/extension/src/popup/store.test.ts` — Zustand slice composition + `chrome.storage.onChanged` subscription with cleanup
- [ ] `apps/extension/src/popup/status.test.ts` — `computeStatus` pure function 5-state coverage
- [ ] `apps/extension/src/popup/grouping.test.ts` — author grouping alphabetical (case-insensitive) + count
- [ ] `apps/extension/entrypoints/popup/App.test.tsx` — RTL render of full popup with mocked store + assert all 5 badge variants + toggle dispatch + error-stack expand
- [ ] `tools/build-experiments.test.ts` — extend Phase 1 with `registry.json` shape + chunk-path mapping + `manualChunks` placement
- [ ] `packages/experiment-sdk/src/registry.test.ts` — `byId` helper (found / not-found / empty)
- [ ] `packages/experiment-sdk/src/manifest.test.ts` — extend with compile-test importing `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`
- [ ] `apps/extension/src/test-setup/chrome-mock.ts` — extend with `storage.onChanged` fireChange wiring, `storage.session.setAccessLevel`, `runtime.getURL`
- [ ] Framework adds (in `apps/extension/`): `pnpm add -D @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `apps/extension/vitest.config.ts` — set `environment: 'jsdom'` (or per-file pragma) so RTL renders work

---

## Wave 4 Co-Located TDD Tests

> Tests that ship alongside their implementation (not Wave-0 infra). Per Warning 9 fix from checker iteration 1.

- [ ] `apps/extension/src/content/contract.test.ts` — TS-only `@ts-expect-error` violations for ENG-04 contract (co-located with content-script engine in Plan 02-07)
- [ ] `apps/extension/src/content/abort-signal.test.ts` — AbortSignal honored on cleanup; `AbortError` not escalated (co-located with content-script reconcile body in Plan 02-07)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5-status-badge visual render in popup | UI-04 | `Badge` variants need pixel-level QA; jsdom does not validate Tailwind class application | Build (`pnpm build`), load `apps/extension/.output/chrome-mv3/` via Chrome "Load unpacked", open popup with `experiments/andrew/smoke/` plus three storage-injected fixtures (one each for `pending`, `error`, `auto-disabled`); confirm each badge renders with documented color + label per `02-CONTEXT.md` D-23. |
| Toggle persists across SW termination | Roadmap success #2 | `chrome://serviceworker-internals` "Stop" button cannot be invoked from a CLI test | On `https://ya.ru/` with smoke pinking, toggle ON → page pink → open `chrome://serviceworker-internals` → click "Stop" on the extension SW → wait 2 seconds → re-open popup → toggle still ON → page is still pink (or re-pinks on next reconcile). |
| 3-errors-in-10s trip + auto-disable visible reason | ENG-06 / Roadmap success #4 | The sliding-window math is unit-tested but the visible-reason UX is end-to-end | Edit smoke `experiment.ts` to throw on apply → toggle ON → tab tries to apply, fails 3× in <10s → popup shows `Auto-disabled` red-outline badge + line `Disabled after 3 errors in 10s — toggle off/on to re-enable.` → toggle OFF → toggle ON → counter resets, smoke applies again (or fails again, fresh 10s window). Other experiments on the page keep running. |
| `registry.json` artifact present | BLD-03 | Build emission verified by unit, but production presence on disk is a phase-gate fact | `cat apps/extension/.output/chrome-mv3/registry.json` shows valid JSON array with all 9 fields per experiment (`id, author, folder, name, description, scope, world, chunkPath, tweaks`). |
| Toggle revert on ya.ru | Roadmap success #2 | Verifies content-script reconcile loop cleans up DOM mutations | On `https://ya.ru/` with smoke pinking, toggle OFF in popup → page reverts to white within ~1 second → popup status badge changes from green "Applied" to gray "Off". |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (every command uses `--run`)
- [ ] Feedback latency < 30s (per-package `vitest --run` consistently completes well under)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (planner / executor seal during Phase 2 plan-checker pass)
