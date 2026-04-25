---
phase: 1
slug: foundation-spike-engine-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `apps/extension/vitest.config.ts` (extends WXT) + root `vitest.workspace.ts` (Wave 0 installs both) |
| **Quick run command** | `pnpm test --run --changed` |
| **Full suite command** | `pnpm test --run && pnpm typecheck && pnpm lint && pnpm check-csp && pnpm build` |
| **Estimated runtime** | ~25 seconds (full suite incl. build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --changed`
- **After every plan wave:** Run `pnpm test --run && pnpm typecheck && pnpm lint && pnpm check-csp`
- **Before `/gsd-verify-work`:** Full suite green + manual smoke checklist in `docs/spike/MV3-FOUNDATION.md` checked off
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled per task by the planner. Each row maps a task to a falsifiable verification command.
> Manual rows are explicit Phase 1 carve-outs (full SW lifecycle automation deferred to Phase 6).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | infra | — | N/A | smoke | `pnpm install --frozen-lockfile` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | MAN-01 | — | manifest schema rejects malformed input | unit | `pnpm vitest run packages/experiment-sdk/src/manifest.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 2 | ENG-02 | T-1-02 | SW listeners registered top-level so wake-up works post-termination | unit | `pnpm vitest run apps/extension/src/shared/storage.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 2 | ENG-03 | — | engine routes by `world` field (no cross-world leakage) | unit | `pnpm vitest run apps/extension/src/content/world-routing.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | ENG-05 | T-1-05 | one experiment's `apply()` throw doesn't break others | unit | `pnpm vitest run apps/extension/src/content/error-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 3 | BLD-01 | — | build discovery via `import.meta.glob` (no runtime fetch under MV3 CSP) | unit | `pnpm vitest run tools/build-experiments.test.ts -t discovery` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 3 | BLD-02 | — | invalid manifest fails build with readable error | unit | `pnpm vitest run tools/build-experiments.test.ts -t validation` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 3 | ENG-01 | — | extension loads via "load unpacked" | build smoke | `pnpm build && test -f apps/extension/.output/chrome-mv3/manifest.json` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 3 | ENG-01 | — | URL match-pattern matcher correct for ya.ru apex + subdomain | unit | `pnpm vitest run apps/extension/src/shared/url-match.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-10 | 01 | 4 | BLD-05 | T-1-05 | CSP regex blocks `eval`, `new Function`, remote `import("https://...")` | unit + integ | `pnpm vitest run scripts/check-csp.test.ts && pnpm check-csp` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test infrastructure must be created in Phase 1's first wave (none exists yet):

- [ ] `apps/extension/vitest.config.ts` — Vitest config aware of WXT path aliases
- [ ] `vitest.workspace.ts` (root) — workspace-aware test runner
- [ ] `apps/extension/src/shared/url-match.test.ts` — Chrome match-pattern matcher edge cases
- [ ] `apps/extension/src/shared/storage.test.ts` — typed storage adapter (mocked `chrome.storage`)
- [ ] `apps/extension/src/content/world-routing.test.ts` — registry filter by `world` field
- [ ] `apps/extension/src/content/error-isolation.test.ts` — try/catch wrapping (intentional throw, others continue)
- [ ] `tools/build-experiments.test.ts` — discovery, ULID idempotency, Zod error formatting, author-vs-folder check
- [ ] `packages/experiment-sdk/src/manifest.test.ts` — ExperimentManifest schema (valid + invalid)
- [ ] `scripts/check-csp.test.ts` — each CSP regex (positive + negative)
- [ ] Test fixtures: `tests/fixtures/manifests/{valid,missing-id,bad-world,empty-match}.json`
- [ ] `apps/extension/src/test-setup/chrome-mock.ts` — Vitest `vi.stubGlobal` mock for `chrome.*` APIs
- [ ] Framework install: `pnpm add -D -w vitest @vitest/ui` (root)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension loads via "load unpacked" and smoke turns ya.ru pink | ENG-01, success criterion 1 | Requires real Chrome browser; Playwright-driven extension automation deferred to Phase 6 (DIST-03) | 1) `pnpm build` 2) `chrome://extensions` → Developer mode → Load unpacked `apps/extension/.output/chrome-mv3/` 3) Open `https://ya.ru/` 4) Open popup, toggle "Smoke pink" ON → page background pink 5) Toggle OFF → reverts cleanly |
| Service worker survives idle termination — zero in-memory state | ENG-02, success criterion 5 | Requires `chrome://serviceworker-internals` "Stop" UI; full automation needs Playwright + DevTools protocol → Phase 6 | 1) Load extension 2) Open `chrome://serviceworker-internals` 3) Find extension SW, click "Stop" 4) Toggle smoke from popup 5) Confirm apply/cleanup still works (pink applied → SW restarted, not persisted in-memory) |
| Two-world routing — MAIN-world experiment cannot be seen by isolated content script and vice versa | ENG-03, success criterion 2 | Requires page-console inspection of MAIN world globals during spike | 1) Add temp `experiments/andrew/_main-test/` with `world: "main"` setting `(window as any).__SMOKE_MAIN__ = true` 2) Build + reload extension 3) On ya.ru open DevTools console (MAIN world): `window.__SMOKE_MAIN__` → `true` 4) From isolated context-script log: same lookup → `undefined` 5) Remove `_main-test/` after recording |
| Spike report committed with all 5 sections answered (no TBDs / TODOs) | success criterion 2 | Documentation artifact — `/gsd-verify-work` greps for `TBD`/`TODO` as gate | `! grep -E '(TBD\|TODO)' docs/spike/MV3-FOUNDATION.md` |
| CI lint blocks forbidden CSP patterns on a real commit | BLD-05, success criterion 4 | Requires git pre-commit hook + GitHub Actions run | 1) Insert `eval('1+1')` into a tracked source file 2) `git commit` → pre-commit blocks 3) Push to throwaway branch → CI fails 4) Remove insertion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies recorded
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in the per-task table
- [ ] No watch-mode flags in any verify command (`--run` everywhere)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after task-table is finalized)

**Approval:** pending
