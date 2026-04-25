# Project Research Summary

**Project:** Designer Experiment Platform
**Domain:** Chromium MV3 browser extension — DOM-mutation experiment runtime with AI helpers and git-native sharing
**Researched:** 2026-04-25
**Confidence:** MEDIUM (architecture HIGH; specific version pins LOW — see Gaps section)

> **Verification caveat:** Two of four research agents had WebSearch and Context7 denied during their sessions. Version numbers throughout this summary are training-data-derived (knowledge cutoff Jan 2026) and must be verified with `npm view <pkg> version` before lockfile commit. Architectural recommendations are HIGH confidence; exact API behavior in edge cases (SW idle timer values, CRXJS HMR for content scripts, OpenAI SDK in SW context) require a Phase 1 spike to confirm empirically.

---

## Executive Summary

This is a Chromium MV3 browser extension that serves as a runtime for designer-authored DOM-mutation experiments. The product is closest in spirit to Tampermonkey or Stylus, but differentiated by: (a) a git-native workflow where experiments live as JS modules in a monorepo folder per designer, (b) first-class AI helpers (`llm()` and `fetchPage()`) proxied through the extension's service worker, and (c) a manifest-driven tweak system with auto-rendered shadcn/ui controls. Distribution is sideload-only for a closed team of ~3 designers, which eliminates Web Store constraints but introduces specific engineering choices: experiments must be bundled at build time (MV3 forbids runtime-fetched JS), state management must survive service worker termination, and the dev loop must be optimized for rapid designer iteration.

The recommended technical approach is **WXT** (Vite-based MV3 framework) + **React 19** + **shadcn/ui on Tailwind CSS v4** in a **pnpm workspace** monorepo. This stack gives the team file-based entrypoints, the best available content-script HMR, and clean Shadow DOM support for in-page UI — all without Nx/Turborepo overhead. The experiment engine follows a strict `apply({tweaks, helpers, signal}) → cleanup` contract; the service worker acts as the single source of truth for state, LLM proxy, and fetchPage proxy. Experiments are discovered at build time via `import.meta.glob` and loaded lazily per matching URL in the content script.

The dominant risk profile is **correctness before features**: three critical patterns must be correct from the start or require expensive rewrites — service worker state management (SW is killed after ~30s idle; all state must live in `chrome.storage.local`), execution world routing (isolated vs MAIN world; wrong choice breaks either `chrome.*` APIs or page-global access), and Tailwind/shadcn isolation via Shadow DOM (Tailwind preflight destroys host page styling if not scoped). A 2-3 day spike in Phase 1 that validates HMR, dynamic experiment import, and SW lifecycle behavior is the highest-ROI risk mitigation the team can do before committing to any feature work.

---

## Key Findings

### Recommended Stack

WXT is the clear choice for a new MV3 project in 2025-2026: it wraps Vite, provides file-based entrypoints for popup/content/background/options, delivers the best available content-script HMR (approximated — not true HMR; see Gaps), and has active maintenance. Plasmo was the previous leader but its release cadence has slowed. Raw Vite + CRXJS is lower-level and requires more manual wiring. TypeScript is non-negotiable given a multi-author codebase where designers will author experiment modules — types are the primary contract between engine and experiment. Zod validates experiment manifests at build time and derives TypeScript types for free.

The ARCHITECTURE.md originally references CRXJS; STACK.md recommends WXT (which uses Vite/CRXJS under the hood or provides equivalent HMR). **Both files converge on Vite as the bundler and `import.meta.glob` as the experiment discovery mechanism.** The main practical difference is that WXT adds a higher-level abstraction (file-based entrypoints, auto manifest generation) that reduces boilerplate and is worth the abstraction cost at this team size.

**Core technologies:**
- **WXT `~0.20.x`**: MV3 extension framework — file-based entrypoints, HMR, manifest generation, Vite under the hood
- **React 19 + shadcn/ui (latest CLI) + Tailwind CSS v4**: UI layer for popup, side panel, options; shadcn is a stated requirement; Tailwind v4 uses CSS-first config, cleaner for extension build pipelines
- **TypeScript 5.6+**: language — types are the engine/experiment API contract
- **Zod `~3.23+`**: runtime manifest validation with free type inference
- **pnpm workspaces**: monorepo — one extension package, one `experiments/` directory, one optional `packages/experiment-sdk` for shared types; Turborepo/Nx are overkill at this scale
- **`import.meta.glob`**: build-time experiment discovery — MV3-compliant static analysis, no runtime fetching
- **`@webext-core/messaging`**: typed message-passing across popup/content/background contexts
- **Zustand `~5.x`**: popup UI state — lightweight, no Redux boilerplate
- **Vitest** (unit) + **Playwright** (E2E): testing — both integrate with the Vite pipeline
- **Biome**: lint + format in one binary (~10x faster than ESLint+Prettier)
- **OpenAI SDK + Anthropic SDK**: used only in background SW; both ship browser-compatible builds

**What NOT to use:** CSS-in-JS runtimes (Emotion/styled-components) in content scripts — they inject into `document.head` and pollute the host page. `webextension-polyfill` in v1 — dead weight; Chrome MV3 returns Promises natively. `yarn` Berry/PnP — breaks tools that scan `node_modules`. `eval`, `new Function`, remote `import()` anywhere in the codebase — MV3 CSP hard-forbids these.

### Expected Features

The feature landscape maps well to Tampermonkey/Stylus UX patterns (experiment list, per-experiment toggles, popup scoped to current tab, badge counter) plus differentiators that the git-native + AI-helpers positioning unlocks. Research identified 20+ v1 features as P1; the full matrix is in FEATURES.md.

**Must have (table stakes) — users will perceive absence as "broken":**
- Experiment list grouped by author — primary UI surface, matches `experiments/<username>/` repo layout
- Per-experiment enable/disable toggle persisted in `chrome.storage.local`
- URL-scope matching (Chrome match-patterns + regex fallback) — gate for apply
- Auto-rendered tweak UI: toggle, select, text, slider, color, multi-select (all 6 types per PROJECT.md)
- Tweak persistence + re-apply on tweak change without page reload
- Popup scoped to current tab URL
- Toolbar badge counter showing active experiment count
- Error surfacing per experiment in popup (try/catch around `apply()`)
- Search/filter in experiment list
- LLM session call counter visible in popup (financial visibility; users self-fund API keys)
- Reset tweak values to defaults

**Should have (differentiators) — where this product earns its keep over Tampermonkey:**
- `llm(prompt)` helper with per-user API key, service-worker proxy, session counter
- `fetchPage(url, selector?)` helper — SW-mediated, SSR-only, with SPA-shell detection
- Apply order visible and reorderable — answers "why are experiments fighting?"
- Hot-reload dev mode — file-watcher → re-apply without full extension reload
- Auto-generated `description.md` via Cursor/Claude at build time
- Tweak presets loadable from `experiments/<user>/<id>/presets/*.json`
- Fork-to-my-folder from popup UI (mechanism: clipboard/shell command for v1; zip download for v1+)
- Author attribution grouped in popup UI
- "Open in Cursor" deep link per experiment

**Defer to v1.x (add when bottleneck appears):**
- Auto-captured experiment screenshots (trigger: list view > ~10 experiments)
- Per-experiment git changelog (trigger: "what changed?" question recurs)
- Apply-order conflict warnings between experiments (trigger: first real conflict surfaces)
- `.crx` auto-build via GitHub Actions on tag push

**Defer to v2+:**
- Firefox/non-Chromium support
- Chrome Web Store distribution
- Headless SPA rendering for `fetchPage()`
- Cross-device tweak sync
- Real LLM budget enforcement (needs backend)

**Anti-features (deliberately not building):** Visual WYSIWYG editor, in-extension code editor, public experiment marketplace, real-time collaborative editing, conditional tweaks, cross-device sync.

### Architecture Approach

The system has four primary execution contexts wired together through Chrome's messaging APIs: (1) the **background service worker** (stateless orchestrator, LLM proxy, fetchPage proxy, tab routing), (2) the **content script engine** (per-tab runtime that loads matching experiments, builds helper proxies with side-effect ledgers, calls `apply()` / `cleanup()`), (3) the **popup/side panel** (shadcn/ui app for experiment list, tweak controls, apply-order management), and (4) the **options page** (API key management, dev mode toggle). All persistent state lives in `chrome.storage.local` — never in SW module-scope variables, which are wiped when Chrome kills the SW after ~30s idle.

**Major components:**
1. **Service Worker (`background/main.ts`)** — receives all messages from popup and content scripts; manages enabled-experiment state, LLM proxy, fetchPage proxy, tab orchestration; never holds application state in memory
2. **Content Script Engine (`content/engine.ts`)** — loads the manifest registry, matches enabled experiments to current URL, dynamically imports experiment bundles, calls `apply()` with a helpers proxy, tracks cleanup via a per-experiment side-effect ledger; patches `history.pushState` for SPA navigation
3. **Experiment Module (`experiments/<user>/<id>/experiment.js`)** — designer-authored; exports `apply({tweaks, helpers, currentURL, log, signal}) → cleanup`; auto-tracked helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) manage side effects without designer cleanup code
4. **Popup / Options (React + shadcn/ui)** — reads manifest registry and storage state; renders tweak controls from manifest schema; all mutations go through SW messages
5. **Build Discovery (`tools/build-experiments.ts`)** — Vite plugin that scans `experiments/**/manifest.json`, validates with Zod, emits per-experiment code-split entries, generates `dist/registry.json`
6. **Manifest Registry (`dist/registry.json`)** — build artifact; aggregated index consumed by popup and engine; never runtime-fetched from git
7. **Typed messaging and storage adapters (`src/shared/`)** — thin typed wrappers over `chrome.runtime.sendMessage` and `chrome.storage.local` with subscription semantics
8. **Optional `packages/experiment-sdk`** — shared TypeScript types for `ExperimentManifest`, `ApplyArgs`, helper interfaces; designers import for Cursor autocomplete

**Key patterns (all confirmed across STACK, ARCHITECTURE, and PITFALLS):**
- SW is stateless between events — `chrome.storage.local` is the single source of truth
- Shadow DOM from day one for all in-page UI — prevents Tailwind preflight from polluting host page
- `apply() → cleanup` contract with auto-tracked helpers — designers don't write cleanup code
- URL scope matching is shared infrastructure between popup filter and content script engine
- Privileged helpers (`llm`, `fetchPage`) live exclusively in SW — CORS bypass, key isolation, accurate counters
- SPA navigation handled by patching `pushState`/`replaceState` — content scripts don't re-run on history changes

### Critical Pitfalls

All four research files converge on the same top risks. Listed in descending severity and recovery cost:

1. **Service worker treated as a long-lived background page** — SW is killed by Chrome after ~30s idle; any module-scope state (`let cache = new Map()`) is wiped silently. Prevention: all state in `chrome.storage.local`; re-register listeners at module top level; use `chrome.alarms` not `setInterval`. This is the single most common MV3 architectural mistake and recovery cost is HIGH.

2. **Wrong execution world** — content scripts run in an isolated world (can access `chrome.*` APIs, cannot see page globals like `window.__YA_STATE__`); MAIN world is the reverse. Most experiments need the isolated world for tweak access but some need MAIN world for page-global access. The engine must support both worlds through a declared manifest field and a message bridge. Wrong-world errors are confusing and the fix requires an architecture rethink. Prevention: design the two-world routing into the engine in Phase 1.

3. **Tailwind preflight + shadcn/ui polluting host page styling** — Tailwind's preflight is a global CSS reset; injecting it into the page (not a Shadow DOM) resets `h1`, `img`, `box-sizing` etc. across the entire host page. Prevention: all in-page UI inside Shadow DOM via WXT's `createShadowRootUi`; disable preflight for in-page bundles or scope it to the shadow root. Radix UI portals (Dialog, Popover, Tooltip) must be redirected to render inside the shadow root via the `container` prop. This must be decided before any in-page panel code is written — rework cost is HIGH.

4. **MV3 CSP forbids eval, new Function, remote imports** — any dependency or designer experiment that uses `new Function()`, template-compiling libraries, or dynamic `import("https://cdn.../module.js")` breaks silently or refuses to load. Prevention: CI lint rule (`eslint-plugin-security` + custom rule) that fails the build on CSP-violating patterns; experiment authoring docs that make this explicit. Must be a CI check before any experiment ships.

5. **LLM cost runaway without budget guards** — an experiment that calls `llm()` inside a MutationObserver callback, or retries on failure without backoff, can fire hundreds of calls per page session. With 3 designers and per-user API keys, a $200 surprise bill destroys trust in the tool. Prevention: prompt caching by hash, per-session token counter (visible in popup), engine-enforced rate limit on `apply()` invocations, retry with exponential backoff + max 3 attempts. The session counter is a Table Stake (required by PROJECT.md); the cache and rate limiter must ship with the `llm()` helper — not as a v2 addition.

6. **SPA re-renders wipe experiment DOM mutations** — Yandex SERP uses `history.pushState`; content scripts don't re-run on SPA navigation; React reconciliation removes nodes the extension injected. Prevention: patch `pushState`/`replaceState`, use shared MutationObserver with debounce, tag injected nodes with `data-exp-id`, filter self-mutations with an `applyMutation` wrapper. The `applyMutation` wrapper also prevents the MutationObserver infinite-loop pattern (injection triggers observation triggers re-injection).

7. **Per-experiment error isolation** — a single `throw` inside one experiment's `apply()` must not prevent other experiments from running. Prevention: engine wraps every `apply()` and `cleanup()` call in try/catch, reports errors to popup per experiment, auto-disables misbehaving experiments after N errors / T seconds.

---

## Implications for Roadmap

Research points to a **6-phase build order** driven by hard dependencies between layers. The architecture files explicitly document this as "build in this order; each level depends on all levels above." The phase names below align with ARCHITECTURE.md's Level 0-5 structure.

### Phase 1: Foundation Spike and Engine Skeleton
**Rationale:** Three critical unknowns must be validated empirically before any feature work begins — WXT content-script HMR behavior, dynamic `import()` from extension origin in isolated world, and SW termination behavior during in-flight async calls. Building on unvalidated assumptions here causes expensive rework in every later phase. This phase delivers nothing user-facing but de-risks the entire project.
**Delivers:** Loadable extension scaffold; validated HMR workflow document; one smoke experiment (`document.body.style.background = 'pink'`) that applies, cleans up, and reloads; Zod manifest schema; build-time experiment discovery; `dist/registry.json` artifact.
**Addresses pitfalls:** SW lifecycle (Pitfall 1), CSP violations (CI lint, Pitfall 2), execution world routing (Pitfall 3), HMR misunderstanding (Pitfall 15), Shadow DOM decision (Pitfall 5) — decide architecture before writing any in-page UI.
**Research flag:** NEEDS SPIKE — WXT HMR for content scripts, dynamic import cache-busting, SW idle behavior with in-flight fetch. This is the most important spike in the project.

### Phase 2: State Foundation and Popup Shell
**Rationale:** Typed messaging and storage adapters are shared infrastructure that every later feature depends on. The popup toggle-and-list is the first user-visible feature and validates that the popup ↔ SW ↔ content script message chain works end to end.
**Delivers:** Typed storage adapter (`chrome.storage.local` with change subscriptions); typed messaging bus; SW orchestrator (URL match → enabled experiments → broadcast); popup experiment list grouped by author with enable/disable toggles; apply/cleanup round-trip working.
**Addresses pitfalls:** SW-as-single-source-of-truth pattern (Pitfall 1), stable experiment ID scheme (foundational for preset/state/fork), URL-scope matching as shared infrastructure (FEATURES.md dependency note).
**Research flag:** Standard patterns — well-documented Chrome extension patterns, no research needed.

### Phase 3: Tweak System
**Rationale:** The tweak system (manifest schema → auto-rendered controls → validated values → apply/cleanup round-trip) is the platform's primary designer-facing value. It must land as a complete unit — partial tweak implementation creates a confusing UX.
**Delivers:** All 6 tweak types (toggle, select, text, slider, color, multi-select) rendered from manifest; tweak-change → re-apply pipeline; Zod validation of tweak values entering `apply()`; debounced inputs (text/number: 250-500ms, immediate for toggle/select/color); reset-to-defaults button; tweak schema versioning with graceful preset migration.
**Addresses pitfalls:** Re-apply debouncing (Anti-Pattern 5 in ARCHITECTURE.md), tweak schema versioning (Pitfall 24), manifest-driven UI as single source of truth (Anti-Pattern 4).
**Research flag:** Standard patterns — manifest-driven UI generation is well-understood. No research needed.

### Phase 4: Helpers and LLM Integration
**Rationale:** `llm()` and `fetchPage()` are the primary differentiators over Tampermonkey/Stylus. They cannot ship without cost controls and clear error surfaces — a surprise $200 bill would kill adoption in a 3-person team. These helpers depend on the full Phase 2 message chain being stable.
**Delivers:** Options page (API key, provider selection); `llm()` helper with prompt-hash caching, session token counter (visible in popup), exponential-backoff retry, per-experiment rate limiting, SW-only API key access; `fetchPage()` helper with SPA-shell detection, Cloudflare/anti-bot error surfacing; auto-tracked helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) with per-experiment side-effect ledger; streaming LLM via long-lived port.
**Addresses pitfalls:** Cost runaway (Pitfall 7), API key exposure (Pitfall 6), SPA-shell silent failure (Pitfall 13), streaming truncation (Pitfall 17).
**Research flag:** NEEDS SPIKE — verify OpenAI/Anthropic SDK behavior in SW context without `dangerouslyAllowBrowser`; verify SW keep-alive via long-lived port for streaming; verify `fetchPage` message-size limits with realistic HTML payloads (~1MB).

### Phase 5: Dev Experience and Multi-Experiment Composition
**Rationale:** Hot-reload, SPA navigation handling, apply ordering, and preset management are the features that determine whether the daily designer workflow is fast or painful. These are all composable features that build on the stable engine from Phases 1-4. Auto-generated descriptions depend on the build pipeline being stable.
**Delivers:** Hot-reload (dev-only: file-watcher → RE_APPLY_EXPERIMENT message → cache-busted reimport); SPA navigation re-evaluation (pushState/popstate patch, URL-scope re-match); apply order visible and reorderable in popup; multi-experiment isolation with per-experiment try/catch and auto-disable on repeated errors; auto-generated `description.md` via Cursor/Claude at build time with staleness warning; tweak preset save/load from `experiments/<user>/<id>/presets/*.json`.
**Addresses pitfalls:** MutationObserver infinite loop (Pitfall 9, applyMutation wrapper), SPA re-render wiping experiments (Pitfall 4), per-experiment error isolation (Pitfall 8), memory leaks (Pitfall 12, `ctx.*` API ownership), description drift (Pitfall 25), HMR misunderstanding (Pitfall 15 — documented dev workflow matches reality).
**Research flag:** Standard patterns for SPA navigation and error isolation. HMR implementation needs the Phase 1 spike results before design is final.

### Phase 6: Distribution and Acceptance Scenario
**Rationale:** The three-designer end-to-end scenario from PROJECT.md is the v1 acceptance test. Distribution (`.crx` / "load unpacked"), fork-from-UI, onboarding docs, and browser compatibility (Yandex Browser specifically) must all work before calling v1 done.
**Delivers:** Fork-from-UI — Option A (clipboard + shell command) for v1, Option B (zip download) for v1+; `.crx` packaging via `wxt zip` + GitHub Releases workflow; version-check on startup with "update available" banner in popup (sideload does not auto-update); onboarding documentation (clone → create folder → `pnpm dev`); Yandex Browser smoke test; three-designer acceptance scenario validation.
**Addresses pitfalls:** No-auto-update for sideloaded extensions (Pitfall 20), Yandex Browser policy differences (Pitfall 21), fork mechanism feasibility (FEATURES.md dependency note), CODEOWNERS / engine ownership (Pitfall 18 — set before second designer onboards).
**Research flag:** NEEDS VERIFICATION — Yandex Browser sideload behavior is LOW confidence (training data may have drifted; verify in real install during this phase).

### Phase Ordering Rationale

- **Foundation first:** SW lifecycle, execution world routing, and Shadow DOM isolation are the three decisions that require the most expensive rewrites if wrong. Every feature built after Phase 1 accumulates assumptions on top of these.
- **Tweak system before helpers:** The tweak round-trip (manifest → UI → storage → apply) is a complete user-value unit that validates the engine contract. Helpers depend on this contract being stable.
- **Helpers before DX polish:** Hot-reload is a quality-of-life feature; helpers are the product's primary differentiator. Ship what's unique first, then smooth the iteration loop.
- **Distribution last:** Packaging and distribution are well-understood but depend on the feature set being stable. Fork-from-UI and Yandex Browser testing block the acceptance scenario.

### Research Flags

Phases needing deeper research or spikes during planning/execution:
- **Phase 1:** WXT content-script HMR contract; dynamic import cache-busting from extension origin; SW idle termination timing with in-flight fetch; CRXJS vs WXT HMR differences (ARCHITECTURE.md uses CRXJS terminology, STACK.md recommends WXT — reconcile before implementation)
- **Phase 4:** OpenAI/Anthropic SDK in SW context (no `window`, SW origin); SW port keep-alive duration for streaming; `chrome.runtime.sendMessage` practical size limit for `fetchPage` HTML payloads
- **Phase 6:** Yandex Browser sideload behavior and developer mode location; fork-from-UI filesystem access feasibility (File System Access API vs native messaging vs clipboard)

Phases with standard, well-documented patterns (skip `/gsd-research-phase`):
- **Phase 2:** SW state management, typed Chrome APIs, popup ↔ SW message patterns — canonical MV3 patterns
- **Phase 3:** Manifest-driven UI, Zod validation, shadcn/ui components — standard React + Zod patterns
- **Phase 5:** SPA navigation patching, per-experiment error isolation, MutationObserver debouncing — documented patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | WXT vs CRXJS naming inconsistency across research files needs reconciliation; framework-level choices (Vite, React, shadcn/ui, pnpm) are HIGH; specific version pins are LOW — must verify via `npm view` |
| Features | MEDIUM | Structural conclusions (table stakes vs differentiators vs anti-features) are HIGH; specific Tampermonkey/Stylus UI details are unverified in this research pass (WebSearch denied) |
| Architecture | MEDIUM-HIGH | Core patterns (SW lifecycle, execution worlds, Shadow DOM, apply/cleanup contract) are HIGH; CRXJS HMR for content scripts and exact message-size limits are MEDIUM — spike required |
| Pitfalls | MEDIUM-HIGH | The critical pitfalls are well-established MV3 patterns with strong consensus across sources; Yandex Browser-specific behavior is LOW (most likely to have drifted) |

**Overall confidence:** MEDIUM

All four files agree on the architecture fundamentals. The disagreement surface is narrow: exact package versions, CRXJS vs WXT naming in ARCHITECTURE.md, and browser-specific behaviors. None of these block roadmap planning.

### Gaps to Address

- **WXT vs CRXJS naming:** ARCHITECTURE.md was written around CRXJS patterns; STACK.md recommends WXT. Both use Vite; WXT may use CRXJS internally or provide equivalent HMR. The implementing engineer must reconcile this in Phase 1 by reading current WXT docs and confirming HMR behavior matches ARCHITECTURE.md's assumptions. If WXT's content-script HMR differs significantly from the CRXJS model described, Phase 5's hot-reload design will need adjustment.

- **Version pins require pre-lockfile verification:** All version numbers in STACK.md are marked `~` (best-guess targets). Before `pnpm install` and lockfile commit: run `npm view wxt version`, `npm view react version`, `npm view tailwindcss version`, `npm view shadcn version`. Do not proceed with stale versions.

- **Execution world architecture needs early design doc:** PITFALLS.md (Pitfall 3) and ARCHITECTURE.md both flag the isolated-world/MAIN-world split as a foundational decision with HIGH rewrite cost. The engine's world-routing mechanism and the manifest field that declares a per-experiment world preference need to be designed explicitly in Phase 1, not discovered incrementally.

- **Fork-from-UI mechanism is a design call, not an implementation detail:** FEATURES.md and ARCHITECTURE.md both flag this. Browser extensions cannot write arbitrary files to the filesystem. The three options (clipboard + shell command, zip download, GitHub PAT + API) have different UX trade-offs. This decision should be made before Phase 6 begins, with input from the designers who will use it.

- **`fetchPage()` cookie behavior needs empirical verification:** Whether `credentials: 'include'` in a SW fetch carries the user's Yandex session cookies (for authenticated SERP pages) depends on `host_permissions` and Chrome's third-party cookie policy at the time of implementation. Verify in Phase 4 spike.

---

## Sources

### Primary (HIGH confidence — stable, well-documented)
- Chrome Extension MV3 documentation — `developer.chrome.com/docs/extensions/mv3` — SW lifecycle, scripting API, CSP, `world: MAIN`, `host_permissions`, content script injection, `chrome.storage.local` quotas
- MV3 migration write-ups — Chrome team blog + community retrospectives — patterns driving "bundle + rebuild" decision
- shadcn/ui + Radix UI documentation — Portal `container` prop, Tailwind v4 integration, CSS variables theming
- Tailwind CSS v4 documentation — Vite plugin, preflight reset, Shadow DOM scoping patterns
- MDN Web Docs — MutationObserver, Shadow DOM, Content Security Policy

### Secondary (MEDIUM confidence — research tools unavailable; training-data-derived)
- WXT documentation (`wxt.dev`) — framework selection rationale, HMR contract for content scripts; **verify current docs before Phase 1**
- CRXJS Vite plugin (`crxjs.dev`) — HMR patterns referenced in ARCHITECTURE.md; **confirm WXT alignment**
- Tampermonkey, Stylus, VisBug, Optimizely Web, VWO — feature landscape analysis; specific UI details not freshly verified
- OpenAI Node SDK, Anthropic SDK TypeScript — SW compatibility; **verify at Phase 4 integration**
- `@webext-core/messaging`, `@webext-core/storage` — WXT-author tooling; compatibility assumed but verify at install
- Playwright extension testing — `launchPersistentContext` pattern; confirmed in docs through training data

### Tertiary (LOW confidence — needs spike verification)
- Specific version pins (`WXT ~0.20.x`, `React ~19.x`, `Tailwind ~4.0+`, etc.) — training data; verify via `npm view` before lockfile
- Yandex Browser sideload and developer-mode UX — training data may have drifted; verify in real install during Phase 6
- SW idle timer exact values (nominally ~30s; may vary by Chrome version) — verify against current `chrome://version` during Phase 1
- `linkedom` as alternative to offscreen document for DOMParser — listed in STACK.md as worth investigating; low-priority if WXT offscreen document support is clean

---

*Research completed: 2026-04-25*
*Ready for roadmap: yes*
