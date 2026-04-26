# Phase 5: DX, SPA Composition & Sharing - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 turns Crust from a working experiment runner into a daily designer workflow. It covers the local development loop, SPA navigation/reapply behavior, multi-experiment composition, popup search/order controls, tweak presets, repo-oriented sharing helpers, onboarding docs, and an update-available banner.

This phase does not package releases or validate the final three-designer acceptance scenario; those remain Phase 6. It also does not add a backend, Chrome Web Store distribution, remote code loading, or full conflict-resolution UI.

</domain>

<decisions>
## Implementation Decisions

### Development loop
- **D-01:** `corepack pnpm dev` remains the main local workflow. The extension may use dev-only watchers, generated files, polling, or local tooling to shorten iteration, but production builds must still bundle experiments statically for MV3.
- **D-02:** The existing dev watcher and popup registry refresh from commit `a88d6cb` are Phase 5 baseline, not work to duplicate. Planning should extend them into true automatic reapply on file save.
- **D-03:** File-save reapply should preserve tab state and avoid requiring extension reload. A page refresh is acceptable only as a documented fallback when Chrome/WXT cannot hot-swap a content-script asset safely.
- **D-04:** HMR should prioritize popup/options development ergonomics through normal WXT/Vite behavior; do not build a custom HMR framework if WXT already provides enough.

### SPA navigation and mutation behavior
- **D-05:** Engine-level URL change handling must cover `history.pushState`, `history.replaceState`, `popstate`, and same-document navigation. On URL change, scope-out experiments clean up and scope-in experiments apply.
- **D-06:** Reapply scheduling must be debounced and deduplicated so SPA navigation, tweak changes, and dev file changes do not produce overlapping apply/cleanup races.
- **D-07:** Extension-owned DOM must be tagged with stable `data-exp-id` markers. Observer logic must ignore self-mutations to prevent infinite loops.

### Multi-experiment composition
- **D-08:** Apply order is explicit and user-visible. The default order follows enable time; the popup lets the user reorder matching experiments.
- **D-09:** Reordering should feel native to the compact Crust popup. Prefer a restrained drag handle with keyboard-accessible fallback controls over a visually heavy board-style DnD UI.
- **D-10:** v1 composition does not attempt semantic conflict resolution. If two experiments touch the same selector, designers own compatibility by changing order or disabling one experiment.
- **D-11:** Toolbar badge shows the number of currently applied experiments in the active tab. Hide the badge when the count is zero.

### Popup UX and repo sharing
- **D-12:** Popup remains a compact utility surface in the current Crust/shadcn visual language. Add search without turning the popup into a management dashboard.
- **D-13:** Search covers experiment name, author, and description, and works after active-tab scope filtering.
- **D-14:** "Open in Cursor" is a dev convenience. It may rely on dev/build metadata with the local absolute experiment folder path and should degrade gracefully when unavailable.
- **D-15:** New author folders and pulled colleague experiments should appear after `pnpm dev` refresh or production rebuild. The popup should make missing/mismatched scope understandable rather than silently hiding everything.

### Presets
- **D-16:** Presets are repository artifacts under `experiments/<author>/<folder>/presets/<preset-name>.json`; local `chrome.storage.local` tweak values remain per-user and never auto-commit.
- **D-17:** Because MV3 extension pages cannot safely write arbitrary repo files without explicit user/tooling involvement, v1 may implement preset saving through a dev-only local tooling bridge or a clipboard/download command flow. The planner must choose the least fragile path that produces a real file in the repo and is honest in the UI.
- **D-18:** Preset load in the popup should be direct once preset files are present in the built registry. Saving can be more explicit; loading should be easy.

### Descriptions and onboarding
- **D-19:** `description.md` generation should be deterministic and local-first. It can summarize manifest fields, tweak schema, helper usage, scope, and source metadata. It must not require an LLM key or network access during build.
- **D-20:** Staleness warnings compare `description.md` freshness to manifest/experiment source freshness and surface in popup without blocking use.
- **D-21:** `docs/ONBOARDING.md` should be practical and copy-pasteable: clone, install, `corepack pnpm dev`, load unpacked output, create first experiment, test on ya.ru, push.
- **D-22:** Update-available banner should fit sideload reality. Prefer checking a GitHub commit/release endpoint with clear failure handling; do not add a backend service.

### the agent's Discretion
- Exact storage key names, debounce durations, and internal message names.
- Whether preset save uses a dev bridge, CLI-assisted copy command, or browser download, as long as the UX honestly explains what happened and the final repo file path is clear.
- Exact implementation library for drag-and-drop if it does not add disproportionate dependency weight.
- Whether description generation runs in the build plugin or a separate script invoked by build/dev.

</decisions>

<specifics>
## Specific Ideas

- Current UI style is the compact Crust popup/options design already refined in Phase 3/4: strict spacing, theme-aware light/dark, shadcn components, no decorative marketing layout.
- Avoid redundant counters and tags; show numbers only when meaningful.
- For author/experiment discovery, the recent watcher + refresh button is useful but incomplete: Phase 5 should make "file save -> reapply" automatic enough that a designer does not manually toggle an experiment for every edit.
- For file-system operations, be explicit. Designers are already comfortable with Cursor and terminal; a clear command is better than a fake "saved" state that did not write to the repo.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope
- `.planning/ROADMAP.md` — Phase 5 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` — Requirement definitions for ENG-07, ENG-08, ENG-09, DX-01, DX-02, DX-03, DX-04, DX-05, TWK-08, UI-06, UI-07, SHR-01, SHR-02, SHR-04, DIST-02.
- `.planning/PROJECT.md` — Core value, repo-sharing model, out-of-scope boundaries.

### Prior implementation contracts
- `.planning/phases/03-tweak-system/03-CONTEXT.md` — Tweak system behavior, URL filtering, Shadow DOM constraints.
- `.planning/phases/04-helpers-llm-integration/04-CONTEXT.md` — Popup/options style, helper cleanup/rate-limit constraints.
- `.planning/STATE.md` — Recent decisions and the fact that Phase 4 manual smoke passed.

### Existing code entry points
- `tools/build-experiments.ts` — Build-time registry/chunk generation and dev watcher baseline.
- `apps/extension/entrypoints/content-isolated.content.ts` — Current reconcile/apply/cleanup loop.
- `apps/extension/src/content/engine.ts` — Existing filter, rate-limit, and tweak-value helpers.
- `apps/extension/src/shared/storage.ts` — Storage keys and LLM/tweak/session state patterns.
- `apps/extension/entrypoints/popup/App.tsx` and `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` — Current compact popup structure.
- `apps/extension/src/popup/grouping.ts` — Author grouping and URL-scope filtering.
- `apps/extension/wxt.config.ts` — MV3 permissions, web-accessible resources, WXT/Vite plugin wiring.
- `scripts/create-experiment.ts` and `apps/extension/README.md` — Existing self-service experiment creation/documentation baseline.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hydratePopupStore()` in `apps/extension/src/popup/registry-refresh.ts` can support manual refresh and post-dev-registry refresh.
- `createHelperContext()` already tracks experiment side effects; Phase 5 should reuse its cleanup discipline.
- `matchesScope()` already supports Chrome match-patterns plus regex fallback.
- `buildExperiments()` already writes registry/chunks and now has a dev watcher extension point.

### Established Patterns
- Popup state lives in Zustand and is hydrated from `chrome.storage` plus `registry.json`.
- Background-to-content communication uses typed `@webext-core/messaging` wrappers in `apps/extension/src/shared/messages.ts`.
- Persistent user state belongs in `chrome.storage.local`; per-tab applied state belongs in `chrome.storage.session`.
- Build-time manifest validation is centralized in `tools/build-experiments.ts` and SDK Zod schemas.

### Integration Points
- Apply order and preset metadata should extend `RegistryEntry`/storage contracts without breaking current registry consumers.
- SPA navigation and dev reapply should flow through the same reconcile path as toggles and tweak changes.
- Toolbar badge updates should connect to the existing applied-per-tab session state or a background listener that observes applied count changes.

</code_context>

<deferred>
## Deferred Ideas

- Visual conflict-resolution UI for overlapping experiments — v2, explicitly out of scope.
- Browser-native fork-to-folder UI — Phase 6 covers fork via clipboard/shell command for v1.
- Full cloud update/auto-update infrastructure — out of scope for sideload v1.
- Headless SPA rendering for `fetchPage()` — v2.

</deferred>

---

*Phase: 05-dx-spa-composition-sharing*
*Context gathered: 2026-04-26*
