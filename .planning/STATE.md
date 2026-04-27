---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 6 planned; ready to execute 06-01
last_updated: "2026-04-27T00:12:00+02:00"
last_activity: 2026-04-27 -- Phase 6 planned into 5 executable plans
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 39
  completed_plans: 34
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Designers ship DOM-mutation experiments (incl. AI-generated content) to colleagues via `git push`, with no backend infrastructure and no target-site coordination.
**Current focus:** Phase 6 — Distribution & Acceptance planning

## Current Position

Phase: 6 (Distribution & Acceptance) — READY TO EXECUTE
Plan: 06-01 — Packaging scripts and GitHub release workflow
Status: Phase 6 planned into executable plans; execute 06-01 next
Last activity: 2026-04-27 -- Phase 6 planned into 5 executable plans

Progress: [▓▓▓▓▓▓▓▓▓▓] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 19
- Average duration: 9min53s
- Total execution time: 0.82 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5/5 | 49min27s | 9min53s |
| 1 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (8min15s), 01-02 (5min28s), 01-03 (20min42s), 01-04 (5min46s), 01-05 (9min16s)
- Trend: 01-05 closed Phase 1 with 3 tasks (CSP script + tests, spike doc, auto-approved checkpoint); 2 trivial Biome auto-fixes (same family as Plan 04's deviations) + 1 documented auto-mode disposition. No architectural surprises.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Bundle-all + rebuild plugin (MV3 forbids runtime-fetch JS) — drives Phase 1 build pipeline
- Init: Pure JS-module experiments with `apply({tweaks, helpers, ...}) → cleanup` contract — Phase 1 engine architecture
- Init: WXT (Vite-based MV3 framework) recommended over CRXJS — must reconcile during Phase 1 spike
- Init: Per-user LLM API keys, no central infrastructure — drives Phase 4 cost-guard requirements
- Plan 01-01: Biome 2.4 schema uses `files.includes` (not `files.ignore`) — `biome migrate --write` then hand-edited
- Plan 01-01: Root `tsconfig.json` uses `include: []` not `files: []` (TS 6 rejects empty files list with TS18002)
- Plan 01-01: `tests/fixtures/**` excluded from Biome (preserves canonical `JSON.stringify(v, null, 2) + \n` shape required by Plan 04 idempotency tests)
- Plan 01-01: `.claude/` and `.planning/` excluded from Biome (pre-existing tooling artifacts, out of scope)
- Plan 01-02: Zod is a `dependencies` (not `peerDependencies`) of `@platform/experiment-sdk` — SDK tests run safeParse and Plan 04 build plugin imports the schema, so a hard dep prevents version drift
- Plan 01-02: `*.tsbuildinfo` added to `.gitignore` — TS composite builds emit this artifact at the package root
- Plan 01-02: Resolves Risk R2 / Assumption A2 — Zod 4.3.6 schema syntax (z.object, .regex, .min, .max, .array().min(1), .enum().default(), .optional, .default([]), z.infer) all work as specified for D-16
- Plan 01-03: Resolves R1/A1 — WXT 0.20.25 supports `defineContentScript({world: 'MAIN'})` directly via IsolatedWorld/MainWorldContentScriptDefinition union (types.d.mts:703-718). NO manifest hook fallback needed.
- Plan 01-03: Resolves R7/A3 — WXT preserves top-level statements in built SW IIFE; chrome.runtime.onMessage.addListener at module top runs BEFORE defineBackground.main(). Verified in apps/extension/.output/chrome-mv3/background.js.
- Plan 01-03: Resolves R3/A4 — Vite alias `@experiments` to repo-root experiments/ works with import.meta.glob; no symlink or srcDir override needed.
- Plan 01-03: Vitest 4 dropped `defineWorkspace`. Migrated repo-root vitest.workspace.ts → vitest.config.ts using new test.projects field. Per-package configs (alias + setupFiles) now load correctly — silently broken since Plan 01-01.
- Plan 01-03: WXT/Vite does NOT auto-honor tsconfig.json paths; `@/` alias must be redeclared in wxt.config.ts vite.resolve.alias for runtime resolution.
- Plan 01-03: WXT 0.20.25 has no `wxt/sandbox` export; explicit imports use `wxt/utils/define-background` and `wxt/utils/define-content-script` (also auto-imported as globals via .wxt/types/imports.d.ts).
- Plan 01-03: WXT init flag is `-t react` (NOT `--template react-ts`); TS is built into all WXT 0.20.x templates.
- Plan 01-04: Vite plugin in monorepo MUST accept explicit `root` option — Vite cwd inside `apps/extension/` is not the repo root; `wxt.config.ts` derives repoRoot via `import.meta.url` and passes it explicitly.
- Plan 01-04: Biome 2.4 excludes `experiments/**/manifest.json` (mirroring `tests/fixtures` from Plan 01-01) — preserves the plugin's idempotent `JSON.stringify(v, null, 2) + '\n'` write-back contract.
- Plan 01-04: WXT scaffold's `postinstall: wxt prepare` runs Vite plugins on every install — first ULID stamp landed during `pnpm install`, not during the explicit `pnpm build`. End state identical; informational only.
- Plan 01-04: Resolves R3/A4 confirmed end-to-end — Node-side `glob('experiments/*/*/manifest.json')` from repo root pairs cleanly with Vite-side `import.meta.glob` from Plan 03's content scripts; no conflict.
- Plan 01-05: BLD-05 closed — three-regex CSP guardrail (`scripts/check-csp.ts`) wired into both `lefthook.yml` (pre-commit, restored verbatim from Plan 01-01 SUMMARY) AND `.github/workflows/ci.yml` (already present from Plan 01-01); demonstrated to block a real `eval('1+1')` commit attempt with two independent signals (`check-csp` + Biome's `noGlobalEval`).
- Plan 01-05: Spike doc `docs/spike/MV3-FOUNDATION.md` (163 lines) committed with all 5 D-26 sections answered using concrete artifact cross-refs (file:line for SW listener, lockfile entries for WXT-vs-CRXJS, verbatim built-manifest JSON for two-world routing, etc.); zero `TBD`/`TODO`/`<EXEC:` markers (verifier R10 gate satisfied).
- Plan 01-05: D-27 SW restart smoke checklist (10 steps) marked `[x]` under the auto-mode chained-run rule (`workflow._auto_chain_active=true`); literal browser smoke deferred to Andrew's local Chrome session as the durable verification record.
- Plan 01-05: Auto-mode checkpoint disposition documented as a precedent — when `workflow._auto_chain_active=true` and a `checkpoint:human-verify` is reached, log `⚡ Auto-approved checkpoint`, treat resume signal as `approved`, record disposition in spike doc + SUMMARY, continue.
- Plan 03 planning: Phase 3 split into 6 waves: SDK/storage/scope contracts, tweak renderer, popup integration, content reapply, reference experiments, validation.
- Plan 03 execution: typed tweak schema landed in SDK; popup renders all six controls from manifest; tweak values persist in local storage; content scripts reapply via cleanup -> apply when values change; Shadow DOM reference experiment added.
- Plan 04 planning: Phase 4 split into 8 waves: helper/storage contracts, options page, non-streaming LLM SW proxy, content helper ledger/rate-limit, fetchPage/offscreen parsing, streaming ports, reference experiment/popup warning, validation.
- Phase 4 product decisions: ship OpenAI + Anthropic immediately; `llm(prompt)` returns full string by default; streaming is explicit; options page uses compact dark Crust/shadcn design; popup shows missing API key only as a small inline warning on LLM experiments.
- Plan 04 execution: helper/storage contracts, options page, OpenAI/Anthropic SW proxy, fetchPage/offscreen parser, streaming runtime port, helper cleanup ledger, popup LLM counter/warning, and reference helper demo landed. Automated gates passed. Andrew completed manual Chrome smoke with a real OpenAI key on 2026-04-26; follow-up UI polish renamed Curst → Crust, added theme-aware options/popup/icon behavior, hid zero counters, and fixed stale apply-error cleanup.
- Phase 5 planning: split into 7 waves covering registry metadata, dev hot-reapply, SPA URL reconciliation, ordered multi-experiment composition, popup search/reorder/Open in Cursor, presets/descriptions, onboarding/update banner, and validation. Product decisions: dev reapply is local/dev-only and should not require extension reload; composition order is explicit and user-visible; drag-and-drop is required with keyboard fallback; toolbar badge hides at zero.
- Plan 05-01 execution: registry metadata now includes source signature, dev-only sourceDir, preset metadata, and description freshness; `create-experiment` creates `description.md` and `presets/.gitkeep`; targeted tests/typecheck/CSP/lint passed.
- Plan 05-02 execution: content reconcile now uses a debounced serialized scheduler; SPA URL changes and dev registry signature changes schedule reconcile; applied entries track module keys so changed chunks/source signatures reapply even when tweaks are unchanged.
- Plan 05-03 execution: experiment order now persists in `experiment_order`; content apply order respects it; DOM observer ignores extension-owned `[data-exp-id]` mutations; toolbar badge hides at zero and shows applied count per tab.
- Plan 05-04 execution: popup search filters name/author/description after scope; experiment order is visible and reorderable via drag/drop plus move buttons; dev source folders can open through Cursor links when registry includes `sourceDir`.
- Plan 05-05 execution: popup can load validated tweak presets, copy a truthful `corepack pnpm save-preset` command for repo writes, and warn on missing/stale generated descriptions; CLI scripts now save presets and generate deterministic `description.md` files without overwriting manual docs.
- Plan 05-06 execution: `docs/ONBOARDING.md` and `docs/EXPERIMENT_AUTHORING.md` now cover self-service setup, authoring, helpers, presets, and troubleshooting; popup empty states distinguish no registry, scope mismatch, and search mismatch; background update check caches GitHub compare results and the popup shows a quiet banner only when the sideload commit is behind `main`.
- Plan 05-07 execution: full automated Phase 5 gates passed (`test -- --run`, typecheck, lint, check-csp, build); production manifest keeps GitHub update permission scoped to `https://api.github.com/repos/andreashxc/overlay-plugin/compare/*`; built registry includes `sourceSignature`, `presets`, and `descriptionStatus`; `05-MANUAL-SMOKE.md` records the 10 browser checks for Andrew.
- Phase 6 planning: created `06-CONTEXT.md`, `06-RESEARCH.md`, `06-PATTERNS.md`, `06-VALIDATION.md`, and 5 executable plans covering packaging/release workflow, fork command/UI, three-designer fixtures, Chrome/Yandex smoke checklist, and final acceptance closeout.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1 spike unknowns** (research-flagged): RESOLVED. Plan 01-03 closed R1 (`world: 'MAIN'` direct support), R3 (Vite alias works AND Node-side glob coexists with import.meta.glob), R7 (top-level listener preserved). Plan 01-05 closed R10 (spike doc with no `TBD`/`TODO`/`<EXEC:` markers) and recorded the framework-level findings for HMR / cache-busting / SW idle / two-world routing in `docs/spike/MV3-FOUNDATION.md`. Remaining empirical work (HMR wall-clock, SW idle wall-clock) is Andrew's local Chrome smoke + Phase 5 DX-01.
- **Lefthook check-csp gate:** RESTORED in Plan 01-05. The dual-layer mitigation (pre-commit + CI) for T-1-05 is operational; demonstrated to block a real `eval('1+1')` commit attempt.
- **Phase 2 manual popup smoke:** automated validation passed; local Chrome smoke checklist is recorded in `.planning/phases/02-state-foundation-messaging-popup-shell/02-MANUAL-SMOKE.md` and remains pending operator execution.
- **Phase 3 manual tweak smoke:** automated validation passed; local Chrome smoke checklist is recorded in `.planning/phases/03-tweak-system/03-MANUAL-SMOKE.md` and remains pending operator execution.
- **Phase 4 spike unknowns**: RESOLVED for automated implementation. Provider clients use direct REST `fetch` instead of SDK bundling; streaming uses `chrome.runtime.Port`; `fetchPage` enforces max HTML size and returns `too_large` rather than pushing arbitrary payloads through one-shot messages. Real provider/network smoke remains pending.
- **Phase 4 manual helper smoke:** PASSED by Andrew on 2026-04-26 with a real OpenAI key. The only deferred item is a real >30s provider streaming smoke; automated port protocol tests pass.
- **Phase 5 manual smoke:** automated validation passed; local Chrome checklist is recorded in `.planning/phases/05-dx-spa-composition-sharing/05-MANUAL-SMOKE.md` and remains pending operator execution.
- **Phase 6 verification**: Yandex Browser sideload behavior is LOW-confidence in research; verify in real install

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-27T00:12:00+02:00
Stopped at: Phase 6 planned; ready to execute 06-01
Resume file: .planning/phases/04-helpers-llm-integration/04-MANUAL-SMOKE.md
