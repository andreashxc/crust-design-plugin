# Phase 5 Research: DX, SPA Composition & Sharing

**Researched:** 2026-04-26
**Status:** Ready for planning

## Phase Inputs

Phase 5 requirements: ENG-07, ENG-08, ENG-09, DX-01, DX-02, DX-03, DX-04, DX-05, TWK-08, UI-06, UI-07, SHR-01, SHR-02, SHR-04, DIST-02.

Phase 5 must build on commit `a88d6cb`, which already added:

- `tools/build-experiments.ts` dev watcher support for `experiments/**`
- generated registry/chunk refresh in WXT dev output
- popup manual `Reload experiments`
- `scripts/create-experiment.ts`
- initial extension README experiment workflow

That baseline is useful, but not yet sufficient for Phase 5 success criteria because file-save changes do not automatically trigger content-script cleanup/reapply.

## Existing Architecture Findings

### Registry and chunks

- `tools/build-experiments.ts` owns discovery, validation, ULID write-back, registry emission, and chunk emission.
- Registry is currently a JSON array of `RegistryEntry`.
- The popup and content script both fetch `chrome.runtime.getURL('registry.json')`.
- Existing dev refresh cleans old `chunks/experiments-*.js` and writes fresh chunks, so content scripts can compare `chunkPath` changes to detect source updates.

Implication: Phase 5 can implement dev hot reapply without violating MV3 by polling or being notified that `registry.json` changed, then re-importing the new chunk URL. The URL changes because chunk hash changes.

### Content reconcile

- `apps/extension/entrypoints/content-isolated.content.ts` owns the current apply/cleanup loop.
- `reconcile(tabId)` already computes `wantOn` from enabled state, auto-disable state, scope, and registry.
- Applied experiments are tracked in a local `cleanups` map with `cleanup`, `AbortController`, and tweak `valuesKey`.
- `setAppliedInTab(tabId, ids)` writes per-tab applied state to `chrome.storage.session`.

Implication: Phase 5 should avoid adding a separate engine. SPA navigation, dev registry changes, tweak changes, and order changes should all schedule the same reconcile pipeline.

### URL and observer helpers

- `helpers.onUrlChange()` already patches `history.pushState` / `replaceState` and listens to `popstate` / `hashchange`, but it is per-experiment helper behavior.
- Engine-level SPA support should patch once per content script, not once per experiment.
- `waitFor()` uses a per-helper `MutationObserver`; there is no shared engine observer yet.

Implication: Add shared engine utilities for URL-change subscription and debounced reconcile scheduling. If a global MutationObserver is introduced, it must ignore extension-owned nodes tagged with `data-exp-id`.

### Popup state

- Popup uses Zustand, shadcn components, and compact CSS in `apps/extension/entrypoints/popup`.
- `groupByAuthor()` filters registry entries by active tab URL.
- `AuthorGroup` shows only non-zero enabled counts.
- `ExperimentRow` already has a compact card layout and tweak collapse behavior.

Implication: Search, order controls, presets, open-in-Cursor, and update banners should fit the existing header/card structure instead of replacing it.

### Storage

- `apps/extension/src/shared/storage.ts` centralizes keys.
- Durable user state is in `chrome.storage.local`.
- Per-tab/session state is in `chrome.storage.session`.

Implication: Add storage helpers instead of ad hoc keys:

- `experiment_order`: ordered experiment ids, durable local
- `preset_selection:<id>` if current preset selection should persist, local
- `update:last_check` / `update:last_result`, local or session depending on UX

### Background and action icon

- `apps/extension/src/background/action-icon.ts` currently switches toolbar icon by theme.
- `background.ts` listens to typed messages and handles storage/session setup.
- No toolbar badge support exists yet.

Implication: Add badge helpers near action-icon and update counts from applied-per-tab changes or explicit content-script message. Hiding zero count should use `chrome.action.setBadgeText({ text: '' })`.

## Implementation Approach by Requirement

### DX-01: file-save reapply

Recommended approach:

1. Extend dev registry output with a lightweight content-change signal. The least invasive option is to keep registry as the source of truth and compare a stable signature derived from each enabled entry's `chunkPath` + tweak schema.
2. In content script, enable dev-only polling when `import.meta.env.DEV` is true:
   - fetch `registry.json` every ~750-1000ms
   - compute signature for enabled/scope-matching entries
   - when changed, schedule reconcile
3. Reconcile should reapply if either tweak values changed OR `entry.chunkPath` changed.
4. Track `moduleKey` alongside `valuesKey` in the `cleanups` map.

Why polling is acceptable: it is dev-only, local extension-origin fetch, simple, and does not require a custom Vite-to-extension websocket bridge.

Acceptance target: changing `experiments/<author>/<folder>/experiment.ts` while `pnpm dev` runs updates `registry.json`/chunk and content script re-applies in under 2 seconds.

### DX-02: popup HMR

WXT/Vite already handles popup HMR in dev. The plan should verify this and document it, not replace it.

Acceptance target: editing popup React/CSS while WXT dev runs updates popup after reopen or HMR without a production rebuild.

### ENG-07: SPA navigation

Recommended approach:

- Add `createUrlChangeWatcher(callback)` under `apps/extension/src/content/url-change.ts`.
- Patch `history.pushState` / `replaceState`, listen to `popstate` and `hashchange`.
- Emit only when `location.href` actually changes.
- Use a debounced scheduler so repeated SPA events coalesce.

Acceptance target: pushState from `https://ya.ru/` to `https://ya.ru/yandsearch?...` causes scope re-evaluation, cleanup of scope-out experiments, and apply of scope-in experiments.

### ENG-08: shared mutation observer and self-mutation guard

Phase 5 does not need a semantic conflict detector. It does need a safe mechanism to respond to dynamic SPA DOM changes without looping.

Recommended approach:

- Add `createDomChangeScheduler({ ignoredAttribute: 'data-exp-id' })`.
- Observe `document.documentElement` with `childList: true, subtree: true`.
- Ignore mutation records whose target or added nodes are inside `[data-exp-id]`.
- Debounce reconcile or targeted helper wait triggers.

Acceptance target: experiment-injected nodes tagged `data-exp-id` do not trigger infinite reapply loops.

### ENG-09: apply order and reorder UI

Recommended approach:

- Store durable order as `experiment_order: string[]`.
- Sorting rules:
  1. ids in `experiment_order` first, in stored order
  2. unknown ids after, by registry order
  3. when enabling a new experiment, append it if missing
- Popup shows a small grip/reorder affordance only for matching entries.
- Use native HTML drag/drop or a very small custom pointer implementation before adding a heavy DnD dependency.
- Provide keyboard fallback with up/down icon buttons for accessibility and deterministic tests.

Acceptance target: reorder updates storage and the next reconcile applies experiments in the new order.

### UI-06: search

Recommended approach:

- Add a compact search input near the popup header.
- Search after active-tab scope filtering.
- Match lowercase name, author, description.
- Preserve author grouping, hiding empty groups.

Acceptance target: typing `helper`, `andrew`, or description text filters rows.

### UI-07: toolbar badge

Recommended approach:

- Add background helper `setAppliedBadge(tabId, count)`.
- Content script sends `APPLIED_COUNT_CHANGED` after `setAppliedInTab`.
- Background sets text to `String(count)` when count > 0, otherwise `''`.
- Badge background color should match Crust accent or system-neutral; keep it readable in both browser themes.

Acceptance target: active tab badge reflects currently applied experiment count and disappears at zero.

### TWK-08: presets

Important constraint: an MV3 extension cannot silently write arbitrary files into a local git repo. Do not fake success.

Recommended v1 approach:

- Build tool discovers `experiments/<author>/<folder>/presets/*.json` and includes preset metadata in registry entries.
- Popup can load presets directly by applying preset values to `tweaks:<id>`.
- Saving should use an explicit dev-safe path:
  - preferred: a local dev bridge in the WXT/Vite plugin that accepts preset save requests and writes the JSON file while `pnpm dev` is running
  - fallback: copy a `corepack pnpm save-preset ...` command or download JSON with a clear target path
- The UI must distinguish "Saved to repo" from "Copied command" / "Downloaded JSON".

Acceptance target: after saving a preset, a real file exists at `experiments/<author>/<folder>/presets/<preset-name>.json`, then reload/build exposes it for loading.

### SHR-01 / SHR-02: self-service users and pulled experiments

Recommended approach:

- Keep `scripts/create-experiment.ts` and expand docs around it.
- Add validation output for wrong depth, author mismatch, invalid manifest, and non-matching scope.
- Popup empty/mismatch state should explain when experiments exist but none match current URL.

Acceptance target: a new `experiments/designer1/foo` appears in popup after dev refresh/build, grouped as `designer1`.

### SHR-04: Open in Cursor

Recommended approach:

- Extend registry with optional `sourcePath` or `sourceDir` emitted by build tool in dev/local builds.
- Popup `Open in Cursor` button appears only when `sourceDir` exists.
- Link format should be generated by a single helper. If `cursor://file/<path>` is unreliable on a machine, fallback to copy absolute path.

Acceptance target: clicking button opens/copies the experiment folder path; unavailable state is hidden or disabled.

### DX-03: description.md generation and staleness

Recommended deterministic approach:

- Add `scripts/generate-descriptions.ts` or integrate into build plugin.
- For each experiment, generate/update `description.md` only when missing or clearly marked as autogenerated.
- Include:
  - name, author, scope, world
  - tweaks table
  - helper usage detected by static string scan (`helpers.llm`, `helpers.fetchPage`, etc.)
  - source files and generated timestamp
- Preserve user-edited descriptions by using frontmatter marker, e.g. `generated: true`.
- Add registry metadata `descriptionStatus: 'missing' | 'fresh' | 'stale' | 'manual'`.

Acceptance target: stale warning appears when `experiment.ts` or `manifest.json` is newer than generated `description.md`.

### DX-05: onboarding

Recommended docs:

- `docs/ONBOARDING.md`
- `docs/EXPERIMENT_AUTHORING.md`
- include exact commands and troubleshooting for:
  - install dependencies
  - run dev
  - load unpacked
  - create first experiment
  - test scope
  - save preset
  - push/pull workflow

### DIST-02: update available

Recommended approach:

- Add config constants for GitHub owner/repo/current commit/version.
- Background checks GitHub Releases or commits endpoint with timeout and graceful failure.
- Add host permission only for the exact GitHub API endpoint needed.
- Popup shows a small inline header banner only when remote version is newer.

Acceptance target: mocked GitHub response triggers "update available"; network failure produces no scary popup error.

## Validation Architecture

### Unit tests

- Registry/preset metadata emission in `tools/build-experiments.test.ts`
- Description generation and staleness detection
- Storage helpers for order, presets, update state
- URL change watcher for pushState/replaceState/popstate/hashchange
- Mutation ignore helper for `[data-exp-id]`
- Order sorting helper and popup search helper
- Badge update helper

### Component tests

- Popup search filters rows and preserves grouping
- Reorder controls update storage and dispatch state changes
- Preset load/save UI states
- Open in Cursor button visibility/fallback
- Update banner visible only when newer remote exists

### Content tests

- Reconcile re-applies when `chunkPath` changes
- Reconcile sorts by stored order
- SPA URL change schedules cleanup/apply
- Self-mutations do not schedule infinite loops

### Build/output checks

- `registry.json` includes presets and optional dev source path metadata
- generated description files are deterministic
- production build still passes MV3 CSP guardrail

### Manual smoke

- `pnpm dev`; edit an enabled experiment; observe reapply in <2s without extension reload
- pushState URL change on ya.ru triggers scope re-evaluation
- enable two experiments, reorder, refresh page, order persists
- save/load preset and verify file exists in repo
- create `experiments/designer1/foo`, refresh dev registry, see author group
- click Open in Cursor
- simulate update-available response

## Planning Risks

- Preset saving is the highest ambiguity because extension pages cannot silently write to repo files. Plans should implement an honest v1 path and document any browser constraints.
- Dev hot-reapply must avoid production polling overhead. Gate it behind `import.meta.env.DEV`.
- Adding GitHub update checks changes extension permissions; keep permissions narrow.
- Registry schema changes must be additive so existing popup/content consumers continue to work.
