# Roadmap: Designer Experiment Platform

## Overview

A Chromium MV3 extension that lets a closed team of designers ship DOM-mutation experiments through a git-native workflow with first-class AI helpers. The roadmap mirrors the strict architectural dependency chain identified in research: a **Foundation Spike** validates the riskiest MV3 unknowns before any feature work; **State + UI shell** establishes the typed message/storage backbone; the **Tweak system** delivers the platform's primary designer-facing value loop; **Helpers** ship the LLM/fetchPage differentiators with mandatory cost guards; **DX, SPA composition, and sharing** smooth the daily designer workflow; and **Distribution + Acceptance** validates the three-designer end-to-end scenario from PROJECT.md. Granularity: standard (6 phases). All 63 v1 requirements map to exactly one phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Spike & Engine Skeleton** - De-risk MV3 unknowns and ship a loadable extension that runs one smoke experiment end-to-end (completed 2026-04-25)
- [ ] **Phase 2: State Foundation, Messaging & Popup Shell** - Typed storage/messaging backbone and an experiment list with working enable/disable
- [ ] **Phase 3: Tweak System** - All 6 tweak types auto-render from manifest, validate, and round-trip through apply/cleanup
- [ ] **Phase 4: Helpers & LLM Integration** - `llm()` and `fetchPage()` ship with cost guards, caching, and SPA-shell detection
- [ ] **Phase 5: DX, SPA Composition & Sharing** - Hot-reload, SPA navigation, multi-experiment ordering, presets, and self-service onboarding
- [ ] **Phase 6: Distribution & Acceptance** - `.crx` packaging, fork-from-UI, Yandex Browser smoke test, and full three-designer acceptance scenario

## Phase Details

### Phase 1: Foundation Spike & Engine Skeleton
**Goal**: A loadable Chromium MV3 extension exists with a validated engine architecture (SW lifecycle, world routing, Shadow DOM) and one smoke experiment that applies and cleans up correctly. The riskiest MV3 unknowns are empirically resolved before any feature work begins.
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-05, BLD-01, BLD-02, BLD-05, MAN-01
**Success Criteria** (what must be TRUE):
  1. The extension loads via "load unpacked" in Chrome and a smoke experiment turns ya.ru pink, then reverts cleanly when the experiment is disabled
  2. A spike report (`docs/spike/MV3-FOUNDATION.md`) is committed documenting verified-vs-broken behaviors for: WXT vs CRXJS reconciliation, content-script HMR, dynamic import cache-busting, SW idle termination behavior, and isolated-world vs MAIN-world routing
  3. The build pipeline discovers experiments under `experiments/<username>/<id>/` via `import.meta.glob`, validates manifests with Zod, and fails the build with a readable error on schema violation
  4. CI lint blocks any commit containing `eval`, `new Function`, or remote `import("https://...")` in plugin or experiment code
  5. The service worker holds zero in-memory state — restarting the SW (via `chrome://serviceworker-internals` "stop") and triggering an event still produces correct apply/cleanup behavior
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Repo + test infrastructure (pnpm + TS + Biome + Vitest + lefthook + CI; Wave 0)
- [x] 01-02-PLAN.md — `@platform/experiment-sdk` (D-15 contract types + D-16 Zod manifest schema) with full test coverage
- [x] 01-03-PLAN.md — WXT scaffold + engine skeleton (stateless SW, two-world content scripts, bare popup, url-match + storage + engine units)
- [x] 01-04-PLAN.md — Build-experiments Vite plugin (D-17 ULID, D-18 author check, D-21 Zod) + smoke experiment (D-28)
- [x] 01-05-PLAN.md — CSP guardrail (BLD-05) + spike report `docs/spike/MV3-FOUNDATION.md` (D-26) + manual smoke verify

### Phase 2: State Foundation, Messaging & Popup Shell
**Goal**: The typed storage adapter, typed messaging bus, and SW orchestrator are in place; the popup lists experiments grouped by author with working enable/disable and per-experiment status; the apply → cleanup round-trip is validated end-to-end through the SW.
**Depends on**: Phase 1
**Requirements**: ENG-04, ENG-06, MAN-03, MAN-04, BLD-03, BLD-04, UI-01, UI-03, UI-04, UI-08
**Success Criteria** (what must be TRUE):
  1. User opens the popup and sees experiments grouped by author with a per-experiment toggle, status indicator (applied / error / disabled), and expandable error stack trace on click
  2. Toggling an experiment in the popup applies/cleans up on every matching tab without page reload, and the change persists across SW termination
  3. Each experiment has a stable ULID-backed ID (renaming the folder does not lose tweak state) and TypeScript types (`ExperimentManifest`, `ApplyArgs`, `Helpers`) are importable from `@platform/experiment-sdk` for Cursor autocomplete
  4. An experiment that throws ≥3 errors in 10 seconds is auto-disabled by the engine with a visible reason in the popup; other experiments on the page keep running
  5. The build emits one code-split chunk per experiment plus a single aggregated `dist/registry.json` with id/author/scope/tweak-schema/chunk-path
**Plans**: TBD

Plans:
- [ ] 02-01: TBD (planned during `/gsd-plan-phase 2`)

**UI hint**: yes

### Phase 3: Tweak System
**Goal**: All six tweak types render from manifest into the popup via shadcn/ui, validate via Zod on every value change, and trigger a clean `cleanup → apply` cycle without page reload. The full manifest-driven UI generation pipeline (the platform's primary designer-facing value loop) works end-to-end with proper Shadow DOM isolation for any in-page UI.
**Depends on**: Phase 2
**Requirements**: TWK-01, TWK-02, TWK-03, TWK-04, TWK-05, TWK-06, TWK-07, MAN-02, UI-02, UI-05
**Success Criteria** (what must be TRUE):
  1. Designer declares 6 tweak types (toggle, select, text, number-slider, color, multi-select) in `manifest.json` and the popup auto-renders shadcn controls (Switch, Select, Input, Slider, ColorPicker, MultiSelect) without any per-experiment React code
  2. Changing any tweak triggers cleanup + apply with new values; text/number inputs are debounced 250-500ms, toggle/select/color apply immediately, and a "Reset to defaults" button restores manifest-declared defaults
  3. Invalid tweak values (Zod fails) skip the apply call and show a structured error in the popup; the experiment never sees malformed input
  4. The popup is filtered to the current tab's URL — only experiments whose `scope` (Chrome match-patterns + regex fallback) match are shown
  5. An experiment that injects an in-page panel renders inside a Shadow DOM via WXT's `createShadowRootUi`; a snapshot of the host page (ya.ru `<h1>` size, `<img>` display, body `box-sizing`) is unchanged before and after extension load
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (planned during `/gsd-plan-phase 3`)

**UI hint**: yes

### Phase 4: Helpers & LLM Integration
**Goal**: `llm()` and `fetchPage()` ship in the SW with mandatory cost guards (cache, session counter, retry+backoff, per-experiment rate limit), the options page accepts an API key per provider, auto-tracked side-effect helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) eliminate designer cleanup boilerplate, and a reference helper-using experiment runs end-to-end on ya.ru.
**Depends on**: Phase 3
**Requirements**: HLP-01, HLP-02, HLP-03, HLP-04, HLP-05, HLP-06, HLP-07, HLP-08, HLP-09
**Success Criteria** (what must be TRUE):
  1. Designer enters an OpenAI/Anthropic API key in the options page; an experiment calls `await llm("...")` and receives a response while the popup increments a visible session counter (calls + tokens) — content scripts never see the key
  2. Calling `llm()` with an identical prompt twice in 10 minutes returns the cached result without a network call; failed calls retry with exponential backoff (max 3 attempts) and surface clear errors instead of silent loops
  3. `fetchPage(url, selector?)` returns parsed HTML for SSR pages (e.g., ya.ru SERP) and a structured `{ok: false, reason: 'likely_spa_shell'}` warning for SPA-shell responses (no silent empty results)
  4. Engine-enforced per-experiment rate limit caps `apply()` invocations at N/T seconds — a stress test calling `llm()` from a MutationObserver callback fires the circuit breaker, not 100 LLM requests
  5. An experiment using only `helpers.injectStyle/injectNode/waitFor/onUrlChange` (no manual cleanup code) produces zero leaked listeners or detached DOM nodes after disable, verified via devtools event listener count
  6. A long streaming LLM response (>30s) completes via long-lived `chrome.runtime` port without SW termination dropping chunks; partial results surface explicitly if the port closes
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (planned during `/gsd-plan-phase 4`)

### Phase 5: DX, SPA Composition & Sharing
**Goal**: The daily designer iteration loop is fast — file save reapplies the experiment without full reload; multiple experiments compose correctly on SPAs (ya.ru pushState navigation re-evaluates scope); apply order is visible and reorderable; auto-generated `description.md` keeps repo docs in sync with code; tweak presets save/load from the repo; new designers self-onboard from documentation alone.
**Depends on**: Phase 4
**Requirements**: ENG-07, ENG-08, ENG-09, DX-01, DX-02, DX-03, DX-04, DX-05, TWK-08, UI-06, UI-07, SHR-01, SHR-02, SHR-04, DIST-02
**Success Criteria** (what must be TRUE):
  1. In dev mode, designer edits `experiments/<me>/<id>/experiment.js` and the change re-applies in <2 seconds without reloading the extension or losing tab state; popup HMR works via standard Vite
  2. Multi-experiment composition works on a single ya.ru tab — designer enables their own experiment + a colleague's, reorders via drag-and-drop in popup, and the new order takes effect on the next apply cycle without errors; the toolbar badge shows the correct active count
  3. SPA navigation (`pushState` from ya.ru `/` to `/yandsearch?text=...`) triggers re-evaluation: scope-out experiments are cleaned up, scope-in experiments apply, and `data-exp-id`-tagged self-mutations don't trigger MutationObserver infinite loops
  4. After `git pull` of a colleague's new experiment + `pnpm dev` (or rebuild), the experiment appears in the popup; designer can search by name/author/description; "Open in Cursor" deep link opens the experiment folder
  5. Designer saves current tweak values as a named preset → file appears at `experiments/<me>/<id>/presets/<name>.json` and reloads correctly via popup; auto-generated `description.md` regenerates on every build with a staleness warning if code is newer than description
  6. A new team member following `docs/ONBOARDING.md` (clone → create folder → `pnpm dev` → load unpacked) reaches "first experiment running" without admin assistance; an "update available" banner appears in the popup if a remote version is newer
**Plans**: TBD

Plans:
- [ ] 05-01: TBD (planned during `/gsd-plan-phase 5`)

**UI hint**: yes

### Phase 6: Distribution & Acceptance
**Goal**: The extension is packaged for sideload distribution via GitHub Releases; the fork-from-UI flow works (clipboard + shell command for v1); the three-designer acceptance scenario from PROJECT.md passes end-to-end on both Chrome and Yandex Browser. v1 is shippable.
**Depends on**: Phase 5
**Requirements**: BLD-06, SHR-03, DIST-01, DIST-03, ACC-01, ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07
**Success Criteria** (what must be TRUE):
  1. `pnpm build` produces both an unpacked `dist/` directory and a `.crx` file ready for sideload; pushing a git tag triggers a GitHub Releases workflow that uploads both artifacts
  2. The repo contains 3 designer folders (designer1, designer2, designer3), each with ≥1 experiment, where ≥1 experiment uses `llm()`, ≥1 uses `fetchPage()`, and ≥1 has 3+ tweak types working correctly through tweak changes
  3. The fork scenario passes end-to-end: from designer2's popup, clicking "Fork to my folder" on a designer1 experiment shows a clipboard-ready shell command; running it copies the experiment to `experiments/designer2/<forked-id>/` and after rebuild the fork appears in designer2's popup
  4. The composition scenario passes: designer1 enables their own experiment + designer2's experiment on the same ya.ru tab, reorders them via drag-and-drop, and observes correct re-apply behavior with no DOM duplication or apply-order regressions
  5. Sideload installation succeeds in both Chrome and Yandex Browser following the documented onboarding procedure (clone → `pnpm dev` → load unpacked); a brand-new user reaches "first experiment running" in under 15 minutes
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (planned during `/gsd-plan-phase 6`)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Spike & Engine Skeleton | 5/5 | Complete    | 2026-04-25 |
| 2. State Foundation, Messaging & Popup Shell | 0/TBD | Not started | - |
| 3. Tweak System | 0/TBD | Not started | - |
| 4. Helpers & LLM Integration | 0/TBD | Not started | - |
| 5. DX, SPA Composition & Sharing | 0/TBD | Not started | - |
| 6. Distribution & Acceptance | 0/TBD | Not started | - |
