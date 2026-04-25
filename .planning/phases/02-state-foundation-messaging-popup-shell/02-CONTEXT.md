# Phase 2: State Foundation, Messaging & Popup Shell — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** `--auto` (Claude selected the recommended option for every decision; see DISCUSSION-LOG.md for the alternatives considered.)

<domain>
## Phase Boundary

Phase 2 turns the Phase 1 skeleton into a usable shell:

- **Typed messaging bus** between popup ↔ service worker ↔ content scripts replaces the two-message tag union from Phase 1.
- **SW orchestrator** owns the apply → cleanup round-trip, broadcasts state changes, counts errors, and trips the auto-disable circuit breaker.
- **Storage shape** for `enabled`, per-tab status, error windows, and auto-disabled flags is locked — every key is ULID-backed (closes MAN-03).
- **Popup** built with shadcn/ui components shows experiments **grouped by author** with a working toggle, status indicator, and per-experiment error display (short message + click-to-expand stack trace).
- **Build artifacts** evolve: `dist/registry.json` is emitted with `id, author, name, description, scope, world, chunkPath, tweaks` for every experiment, and Vite's `import.meta.glob` continues to drive code-split chunk emission so each experiment ships in its own JS chunk (BLD-04).
- **`@platform/experiment-sdk`** grows: `RegistryEntry`, `ExperimentStatus`, `ErrorRecord` types are added next to the existing `ExperimentManifest`, `ApplyArgs`, `Helpers`, `ApplyFn`, `CleanupFn` so designers get autocomplete in Cursor (closes MAN-04).
- **End-to-end validation:** toggling an experiment from the popup applies it on every matching tab without page reload, the change persists across SW termination, and an experiment that throws ≥3 times in 10 seconds is auto-disabled with a visible reason while siblings keep running.

**In scope (10 requirements):** ENG-04, ENG-06, MAN-03, MAN-04, BLD-03, BLD-04, UI-01, UI-03, UI-04, UI-08.

**Out of scope (deferred to other phases):**
- 6 tweak types + auto-render via shadcn (TWK-01..TWK-07) — Phase 3.
- URL-filter inside the popup (UI-05) — Phase 3.
- Shadow DOM mount for in-page experiment UI (UI-02) — Phase 3.
- `llm()` / `fetchPage()` and any options-page UI for API keys — Phase 4.
- Hot-reload, SPA navigation, drag-and-drop ordering, search, badge counter — Phase 5.
- `.crx` / GitHub Releases / fork-from-UI — Phase 6.

**Specifically NOT in this phase even though they are tempting:**
- Options page (UI-01 mentions both popup *and* options page) — we ship **popup only**; the options page is created in Phase 4 when API-key UX is needed.
- Real cleanup-registry abstraction in the SW — content scripts already own per-tab cleanups in Phase 1 (`cleanups: Map<id, CleanupFn>`); Phase 2 keeps that shape and the SW remains stateless.
- Drag-and-drop ordering of experiments — Phase 5 (ENG-09).
- Tweak storage keys (`tweaks:<id>`, `presets:<id>`) — Phase 2 *names* the convention (D-21) but does not implement the values until Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Engine Contract Hardening (ENG-04)

- **D-01:** **`apply({tweaks, helpers, currentURL, log, signal}) → cleanup` is locked verbatim** as the SDK type already exports it (`packages/experiment-sdk/src/index.ts`). Phase 2 makes that contract *enforced*, not aspirational: every code path that invokes an experiment passes the full args object, and a TypeScript-only test (`apps/extension/src/content/contract.test.ts`) compiles a deliberate violation to assert the type error.
- **D-02:** **`signal: AbortSignal` is honored on cleanup.** The reconcile loop creates an `AbortController` per applied experiment, stores it next to the cleanup, and calls `controller.abort()` *before* invoking the cleanup so async work in the experiment can opt-out. `AbortError` thrown from the experiment is treated as a successful cleanup, not an error toward the auto-disable counter.
- **D-03:** **`helpers` stays minimal in Phase 2** — only `{log}`. `injectStyle/injectNode/waitFor/onUrlChange/llm/fetchPage` arrive in Phase 4 (HLP-01..HLP-09). The type stays in the SDK so Phase 4 is a structural extension, not a breaking change for existing experiments.

### Messaging Bus & SW Orchestrator

- **D-04:** **Adopt `@webext-core/messaging`** for typed messages between popup ↔ SW ↔ content scripts, replacing the hand-rolled `isExtensionMessage` tag union. Rationale: same maintainer as WXT (guaranteed compat), eliminates `unknown`-cast boilerplate, gives request/response shape with type-safe payloads. The Phase 1 file `apps/extension/src/shared/messages.ts` already predicted this move.
- **D-05:** **Message catalogue (Phase 2):**
  - `EXPERIMENT_TOGGLE` (popup → SW): `{id: string, enabled: boolean}` → `{ok: true} | {ok: false, error: string}`.
  - `STATE_CHANGED` (SW → all tabs broadcast): no payload — receivers re-read storage and reconcile.
  - `EXPERIMENT_ERROR` (content script → SW): `{id: string, phase: 'apply' | 'cleanup', message: string, stack?: string}` → `{ok: true}`. SW counts toward the auto-disable window and persists `last_error:<id>`.
  - `STATUS_QUERY` (popup → active content script): no payload → `{[id]: ExperimentStatus}`. Popup uses this to render status for the active tab on open.
  - **No** `STATUS_UPDATE` push — status is a pull (popup reads on open + subscribes to `chrome.storage.onChanged`). Push would require the popup to be open, which it usually isn't.
- **D-06:** **SW remains stateless** (carries forward Phase 1 D-12 / SP-1). All counters (`error_window:<id>`), flags (`autodisabled:<id>`), and persistence (`enabled`, `last_error:<id>`) live in `chrome.storage.local` or `chrome.storage.session`. The SW handler reads → mutates → writes → broadcasts; nothing lives in module scope.
- **D-07:** **SW orchestrator file:** `apps/extension/entrypoints/background.ts` keeps the Phase 1 top-level-listener contract (SP-7), but the listener body is split into typed handlers in `apps/extension/src/background/handlers/` (one file per message type). All handlers are *registered* at module top via `defineMessaging()`; the registration is synchronous and listener-binding-safe.

### Status Model (UI-04, UI-08)

- **D-08:** **Five status states** per experiment row in the popup:
  | Status | Meaning |
  | --- | --- |
  | `disabled` | Toggle is OFF. |
  | `pending` | Toggle ON, but the active tab's URL doesn't match `scope` → no apply on this tab. |
  | `applied` | Toggle ON, scope matches active tab, apply succeeded. |
  | `error` | Toggle ON, last apply or cleanup threw — error not yet enough to trip auto-disable. |
  | `auto-disabled` | Engine tripped the breaker (≥3 errors in 10s). Toggle is still ON in user intent, but the engine refuses to apply until cleared. |
- **D-09:** **Source of truth for status** is `chrome.storage` (no live messaging push). Layout:
  - `enabled: Record<id, boolean>` — user intent (already exists, Phase 1).
  - `autodisabled: Record<id, {reason: string, count: number, firstAt: number, lastAt: number}>` — engine kill-switch state (persistent).
  - `last_error: Record<id, ErrorRecord>` — last error, kept even after recovery so the popup can show "last error N minutes ago" (kept as `last_error:<id>` per-key in Phase 1; Phase 2 promotes to a single `last_error` map for popup-side O(1) read).
  - `chrome.storage.session` `error_window:<id>: {count: number, firstAt: number}` — sliding-window counter (per browser session is sufficient for ENG-06; survives SW restart but resets on browser restart, which is the desired UX).
  - `chrome.storage.session` `applied:<tabId>: id[]` — content scripts write the list of currently-applied experiment ids for *this tab* on every reconcile completion. Popup reads `applied:<activeTabId>` on open.
- **D-10:** **Status is computed in the popup** (not stored as a derived state) by combining `enabled`, `autodisabled`, `last_error`, and `applied:<activeTabId>`. The popup subscribes to `chrome.storage.onChanged` and re-renders when any of those keys change.

### Auto-Disable Policy (ENG-06)

- **D-11:** **Threshold: ≥3 errors in 10 seconds (sliding window).** Mirrors Roadmap success criterion #4 verbatim. An "error" is any throw from `apply()` or `cleanup()` reported via the `EXPERIMENT_ERROR` message; an `AbortError` from cleanup is *not* counted (D-02).
- **D-12:** **Persistence:** `autodisabled:<id>` lives in `chrome.storage.local` (persistent across SW restart and browser restart). The sliding window counter `error_window:<id>` lives in `chrome.storage.session` (resets on browser restart — intentional, errors from a prior session shouldn't haunt the user).
- **D-13:** **Recovery:** the user toggles the experiment OFF then ON in the popup → SW handler clears `autodisabled:<id>` and resets `error_window:<id>` before broadcasting `STATE_CHANGED`. There is **no** auto-clear timer, no separate "Re-enable" button. Toggle = re-arm.
- **D-14:** **Visible reason in popup:** when `autodisabled:<id>` is set, the row's status badge shows `Auto-disabled` (red outline) and the inline error region shows `Disabled after {count} errors in {window}s — click toggle to re-enable.` followed by the last error short message (full stack via the same expand-on-click affordance as `error` state, see D-25). Closes ENG-06.
- **D-15:** **Engine never silently retries an auto-disabled experiment.** The content-script reconcile filters out any id present in `autodisabled` before deciding what to apply, regardless of `enabled` state. Other experiments on the same page keep running (closes Phase 1 D-14 + ENG-05 invariant).

### Build Artifacts (BLD-03, BLD-04)

- **D-16:** **`dist/registry.json` is emitted by the existing `tools/build-experiments.ts` Vite plugin** via `this.emitFile({ type: 'asset', fileName: 'registry.json', source: JSON.stringify(registry, null, 2) + '\n' })` during `generateBundle`. Schema:
  ```ts
  type RegistryEntry = {
    id: string;            // ULID, ULID Crockford base32 (26 chars)
    author: string;        // matches folder, validated at build (Phase 1 D-18)
    name: string;
    description: string;
    scope: { match: string[]; regex?: string[] };
    world: 'isolated' | 'main';
    chunkPath: string;     // relative to extension root, e.g. "experiments/andrew-01HXX....js"
    tweaks: unknown[];     // opaque in Phase 2; Phase 3 narrows via discriminated union
  };
  ```
  Output: `Registry = RegistryEntry[]` (flat array). The SDK exports both the type and a small `byId(registry, id)` helper for O(1) lookup at runtime.
- **D-17:** **Code-split chunk strategy (BLD-04):** continue using the Phase 1 `import.meta.glob('@experiments/*/*/experiment.ts')` (NOT eager) — Vite already produces one chunk per experiment, that's free. Lock the chunk file name pattern via `rollupOptions.output.chunkFileNames` to a stable shape: `experiments/[name]-[hash].js`, where Vite's default `[name]` already encodes the experiment file location well enough for audit. The build plugin discovers the produced chunk path during `generateBundle` and writes it into the corresponding `RegistryEntry.chunkPath`.
- **D-18:** **Two sources of truth, single producer.** The build plugin scans `experiments/*/*/manifest.json` once and uses that scan to emit *both* `dist/registry.json` (for popup + SW reads) *and* the metadata that backs the chunk-path lookup. Content scripts continue using `import.meta.glob(..., {eager: false})` for the actual `() => Promise<{apply}>` loaders — that's a build-time dependency Vite needs to resolve chunks. The two artifacts are guaranteed consistent because they come from the same plugin pass.
- **D-19:** **Consumer wiring:**
  - Popup: `fetch(chrome.runtime.getURL('registry.json'))` once on mount → renders rows. Re-reads on `STATE_CHANGED` only if the registry changed (rare; a rebuild-and-reload is the trigger). No use of `import.meta.glob` in popup code (replaces the Phase 1 popup pattern).
  - Content scripts: `fetch(chrome.runtime.getURL('registry.json'))` once on bootstrap → filters by world → matches scope. Then loads each enabled experiment via the existing `import.meta.glob` loader map keyed by the `experiment.ts` path derived from the `RegistryEntry.chunkPath` (or kept side-by-side in a Map). This replaces the Phase 1 `import.meta.glob<{default: unknown}>` for *manifests* but keeps it for *experiment modules*.
  - SW: needs registry too (for `EXPERIMENT_TOGGLE` validation: reject toggle of unknown id). Fetches `registry.json` lazily on first use, no caching (SW is stateless — D-06).

### Popup UX with shadcn (UI-01, UI-03, UI-04, UI-08)

- **D-20:** **shadcn components installed in Phase 2:** `Switch`, `Card`, `Collapsible`, `Badge`, `ScrollArea`, `Button`. Installed via `pnpm dlx shadcn@latest add switch card collapsible badge scroll-area button` from `apps/extension/`. Tailwind v4 + React 19 are already wired in Phase 1. Other shadcn components (`Slider`, `Select`, `Input`, `Tooltip`, `Dialog`) come in Phase 3 with the tweak system.
- **D-21:** **Popup layout (top-down):**
  ```
  ┌──────────────────────────────┐
  │ Experiments         [count]  │  <- header: total enabled count (NOT URL-filtered; Phase 5 adds tab-filter)
  ├──────────────────────────────┤
  │ ▼ andrew (2)                 │  <- Collapsible per author, expanded by default
  │   ┌────────────────────────┐ │
  │   │ Smoke pink   [Applied] │ │  <- Card per experiment: name + status Badge
  │   │ Turns ya.ru pink…      │ │
  │   │            [toggle]    │ │
  │   └────────────────────────┘ │
  │   ┌────────────────────────┐ │
  │   │ Other exp     [Error]  │ │
  │   │ Last error: TypeError… │ │  <- short error message
  │   │ ▶ Show stack trace     │ │  <- click to expand inline (D-25)
  │   │            [toggle]    │ │
  │   └────────────────────────┘ │
  │ ▶ designer1 (1)              │  <- collapsed when zero match active tab
  │ ▼ designer2 (3)              │
  │   …                          │
  └──────────────────────────────┘
  ```
- **D-22:** **Author grouping behavior (UI-03):**
  - Authors sorted alphabetically (case-insensitive).
  - Each group shows `{author} ({n})` where `n` is total experiments by that author (NOT just enabled).
  - Default state: expanded if the author owns ≥1 experiment whose scope matches the active tab; collapsed otherwise. Empty repo → "No experiments yet" empty state (Phase 1 already implements; preserve copy).
  - User-toggled collapse state is *not* persisted (popup is short-lived; remembering across opens adds complexity).
- **D-23:** **Status indicator (UI-04):** colored badge with text label, color-blind-safe palette via shadcn `Badge` `variant`:
  | State | Variant | Color | Label |
  | --- | --- | --- | --- |
  | `disabled` | `secondary` | gray | "Off" |
  | `pending` | `outline` | gray-outline | "Pending" |
  | `applied` | `default` | green | "Applied" |
  | `error` | `destructive` | red | "Error" |
  | `auto-disabled` | `destructive` (outline variant via `className`) | red-outline | "Auto-disabled" |
- **D-24:** **Toggle (UI-04):** shadcn `Switch` next to the badge. Disabled-and-spinning while the SW handler is in flight (await on `runtime.sendMessage` round-trip). On error response, status snaps back to previous value and a toast-equivalent inline alert appears in the row (no Toast component — keeps Phase 2 component count small).
- **D-25:** **Error display (UI-08):** for any row with `error` or `auto-disabled` status:
  - Always-visible: 1-line short error message (truncate at 80 chars with `…`), red text.
  - Below: `▶ Show stack trace` clickable label → expands into a `Collapsible` panel with the full stored stack (whitespace-preserved, monospace, scroll if >10 lines). Click again collapses.
  - Auto-disable adds the line `Disabled after {count} errors in {windowSec}s — toggle off/on to re-enable.` above the short error message.
  - No modal, no Dialog — keeps the popup self-contained.
- **D-26:** **Active-tab URL awareness:** the popup queries `chrome.tabs.query({active: true, currentWindow: true})` once on mount. The active tab id is used to read `applied:<tabId>` from `chrome.storage.session`. The full URL is *not* used for filtering rows in Phase 2 (UI-05 = Phase 3); it's only used to compute `pending` vs `applied` (D-08).
- **D-27:** **State management:** a single Zustand store (`apps/extension/src/popup/store.ts`) with slices: `registry: RegistryEntry[]`, `enabled: Record<id, boolean>`, `autodisabled: Record<id, AutoDisableRecord>`, `lastError: Record<id, ErrorRecord>`, `appliedInActiveTab: id[]`, `activeTabId: number | null`. Carries forward Phase 1 D-04. The store wires `chrome.storage.onChanged` once on initialization and dispatches updates per key.

### Stable IDs & Storage-Key Conventions (MAN-03)

- **D-28:** **Every per-experiment storage key is keyed by the manifest ULID,** not by folder path. Locked key shapes:
  | Key | Type | Storage area | Purpose |
  | --- | --- | --- | --- |
  | `enabled` | `Record<ulid, boolean>` | `chrome.storage.local` | User intent |
  | `autodisabled` | `Record<ulid, AutoDisableRecord>` | `chrome.storage.local` | Engine kill-switch (persistent) |
  | `last_error` | `Record<ulid, ErrorRecord>` | `chrome.storage.local` | Last failure (audit) |
  | `error_window:<ulid>` | `{count: number, firstAt: number}` | `chrome.storage.session` | Sliding window counter |
  | `applied:<tabId>` | `ulid[]` | `chrome.storage.session` | Popup-readable per-tab applied set |
  | `tweaks:<ulid>` | `Record<string, unknown>` | `chrome.storage.local` | **Reserved for Phase 3** — declared so Phase 3 lands without a migration |
  | `preset:<ulid>:<name>` | `Record<string, unknown>` | repo file (presets/) | **Reserved for Phase 5** |
  Renaming a folder does not alter the ULID (Phase 1 D-17 guarantees ULID is written into `manifest.json` once and never changes), therefore none of these keys break on rename. Closes MAN-03.
- **D-29:** **Migration of Phase 1 keys.** Phase 1 wrote `last_error:<id>` as separate keys (one per id). Phase 2 promotes this to a single `last_error` *object* under one key. Migration runs once at SW startup: if any `last_error:<ulid>` keys exist, copy into the new map and remove the old keys. After the first run there's nothing to migrate.

### SDK Surface (MAN-04)

- **D-30:** **`@platform/experiment-sdk` exports** (additions to Phase 1):
  ```ts
  export type RegistryEntry = { /* D-16 */ };
  export type Registry = RegistryEntry[];
  export type ExperimentStatus = 'disabled' | 'pending' | 'applied' | 'error' | 'auto-disabled';
  export type ErrorRecord = { phase: 'apply' | 'cleanup'; message: string; stack?: string; at: number };
  export type AutoDisableRecord = { reason: string; count: number; firstAt: number; lastAt: number };
  export function byId(registry: Registry, id: string): RegistryEntry | undefined;
  ```
  Designers `import type { ExperimentStatus, ApplyFn } from '@platform/experiment-sdk';` and Cursor autocompletes everything. Closes MAN-04.
- **D-31:** **The SDK stays zero-runtime** for type-only exports. `byId` is pure and ~5 lines; `Registry`/`RegistryEntry`/etc. are types only. Existing Zod runtime (`ExperimentManifest` schema) stays.

### Claude's Discretion

The following are *not* gray areas worth user input — Claude decides during planning/execution:
- Internal file layout under `apps/extension/src/background/handlers/`.
- Exact naming of the Zustand store actions.
- Whether to extract a `useExperimentRow` hook or keep the JSX inline.
- The shadcn theme tokens (will follow the default `slate` palette — change in Phase 3 if the team has color preferences).
- The exact regex for URL-match in `url-match.ts` (already done in Phase 1; stable).
- The unit-test layout (Vitest, co-located `*.test.ts`, mirroring Phase 1 conventions).
- Whether the storage migration in D-29 runs on every SW wake or one-time idempotent.
- Any choices not explicitly captured above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before работой над фазой.**

### Project foundation
- `.planning/PROJECT.md` — vision, core value, constraints, key decisions table; the Phase 1 entry already records "Bundle-all + rebuild plugin", "Pure JS-module experiments", "Per-user LLM API keys".
- `.planning/REQUIREMENTS.md` §`Engine`, `Build`, `Manifest`, `UI` — Phase 2 owns ENG-04, ENG-06, MAN-03, MAN-04, BLD-03, BLD-04, UI-01, UI-03, UI-04, UI-08; the file lists each plus its 5 verbatim success criteria.
- `.planning/ROADMAP.md` §`Phase 2` — phase goal + 5 success criteria; depends on Phase 1.

### Phase 1 outputs (carried forward)
- `.planning/phases/01-foundation-spike-engine-skeleton/01-CONTEXT.md` — Phase 1 D-01..D-29; in particular D-04 (Zustand picked), D-12 (stateless SW), D-13 (declarative two-world routing), D-14 (per-call try/catch), D-15 (engine contract), D-16 (manifest Zod schema), D-17 (ULID auto-gen), D-22 (registry.json deferred to Phase 2).
- `.planning/phases/01-foundation-spike-engine-skeleton/01-PATTERNS.md` — file-by-file convention map; greenfield disclaimer no longer applies in Phase 2 because Phase 1 produced in-repo analogs.
- `.planning/phases/01-foundation-spike-engine-skeleton/01-RESEARCH.md` — deep research from Phase 1, including R1 (world: 'MAIN' direct support), R3 (alias), R7 (top-level listener), R8 (tweaks discriminated union deferred to Phase 3), R9 (initial reconcile after navigation).
- `.planning/phases/01-foundation-spike-engine-skeleton/01-VERIFICATION.md` — Phase 1 closure record; confirms which Phase 1 success criteria are durable invariants (SW stateless, error isolation, two-world routing, CSP guardrail, build-time discovery).
- `docs/spike/MV3-FOUNDATION.md` — empirically verified MV3 behaviors: WXT vs CRXJS, content-script HMR contract, dynamic import cache-busting, SW idle termination, two-world routing.

### Research outputs
- `.planning/research/STACK.md` §"Recommended Stack" — `@webext-core/messaging` is named explicitly as the typed-message library; `zustand@~5.x` for popup state; `lucide-react` and `clsx + tailwind-merge` come transitively via shadcn; the `pnpm dlx shadcn@latest add ...` command is documented.
- `.planning/research/ARCHITECTURE.md` §"Level 1 — State + Messaging" and §"Level 2 — UI Shell" — Phase 2 directly maps to these levels; the Level 1 storage adapter and Level 2 popup-shell decomposition are normative.
- `.planning/research/PITFALLS.md` Pitfall 1 (SW lifecycle), Pitfall 2 (CSP), Pitfall 3 (world routing) — Pitfall 1 still binds Phase 2 (SW stateless extends to all new handlers), Pitfall 2 binds the build (no `eval`/`new Function` in popup or handlers).
- `.planning/research/FEATURES.md` — feature landscape; Phase 2 ships the popup that hosts every later feature.
- `.planning/research/SUMMARY.md` — research executive summary, gaps, confidence labels.

### In-repo code (Phase 1 in-repo analogs — required reading before any new file lands)
- `apps/extension/entrypoints/background.ts` — top-level listener pattern (SP-7); Phase 2 keeps the contract and splits the body into typed handlers.
- `apps/extension/entrypoints/content-isolated.content.ts` and `content-main.content.ts` — bootstrap + reconcile + cleanup map; Phase 2 layers `EXPERIMENT_ERROR` reporting and reads from `registry.json` instead of in-line `import.meta.glob` for manifests.
- `apps/extension/src/shared/storage.ts` — typed wrapper over `chrome.storage.local`; Phase 2 extends with `getAutoDisabled/setAutoDisabled/clearAutoDisabled`, `getErrorWindow/incrementErrorWindow`, `getAppliedInTab/setAppliedInTab`, `migrateLastErrorToMap` (D-29).
- `apps/extension/src/shared/messages.ts` — Phase 1 tag union; Phase 2 replaces with `defineExtensionMessaging()` from `@webext-core/messaging` and exports the typed protocol.
- `apps/extension/src/content/engine.ts` — Phase 1 `runEngine` + `filterByWorld`; Phase 2 keeps `filterByWorld` and re-uses the per-call try/catch loop in the new reconcile pipeline.
- `packages/experiment-sdk/src/index.ts` — Phase 1 type exports; Phase 2 adds `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId`.
- `tools/build-experiments.ts` — Phase 1 Vite plugin (scan + ULID + Zod + author check); Phase 2 extends with `generateBundle` to emit `registry.json` and to capture chunk paths.
- `apps/extension/wxt.config.ts` — manifest declaration; Phase 2 may need `web_accessible_resources` for `registry.json` if the popup `fetch(getURL(...))` requires it (verify during planning — typical MV3 behavior is that extension-origin assets are accessible without explicit WAR for popup/content scripts on extension origin, but content-script reads from page origin do require it).

### External docs (verify with `mcp__context7__*` / `Context7` during research)
- `@webext-core/messaging` — `webext-core.aklinker1.io/messaging` (same maintainer as WXT) — `defineExtensionMessaging()`, request/response semantics, type inference.
- WXT 0.20 — `wxt.dev/api/config` and `wxt.dev/api/recipes/messaging` — content-script + SW messaging recipes; `web_accessible_resources` declaration via `manifest.web_accessible_resources` field in `wxt.config.ts`.
- shadcn/ui — `ui.shadcn.com/docs/components/{switch,card,collapsible,badge,scroll-area,button}` — install commands, prop tables, default Tailwind classes.
- Tailwind CSS v4 — `tailwindcss.com/docs/v4-beta` (or stable equivalent) — Vite plugin already configured in Phase 1.
- Zustand 5 — `zustand.docs.pmnd.rs` — `create()`, `subscribe()`, slice patterns; `useStore` selector best practices.
- Chrome MV3 — `developer.chrome.com/docs/extensions/reference/api/storage` (storage.local vs storage.session quotas, listener), `developer.chrome.com/docs/extensions/reference/api/runtime#method-getURL`, `developer.chrome.com/docs/extensions/reference/api/tabs#method-query`, `developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources`.
- ULID spec — `github.com/ulid/spec` (Crockford base32, monotonic) — already followed in Phase 1; Phase 2 just consumes.

### Pinned anti-patterns (must-avoid)
- Pitfall 1 (PITFALLS §Critical) — no module-scope state in SW; closed by D-06.
- Pitfall 2 (PITFALLS §Critical) — no `eval`/`new Function`/remote `import("https://...")`; CSP guardrail (`scripts/check-csp.ts`) already enforces this in pre-commit + CI from Phase 1 Plan 01-05.
- Phase 1 anti-pattern (`.continue-here.md` if any in `${phase_dir}`) — none present at Phase 2 start.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/extension/src/shared/storage.ts`** — typed wrapper around `chrome.storage.local`; Phase 2 extends with auto-disable / error-window / per-tab applied helpers (D-09, D-12, D-28, D-29). Pattern lock: every read goes to storage, no in-memory caching (D-06 / Phase 1 SP-1).
- **`apps/extension/src/content/engine.ts`** — `filterByWorld()` and the per-call try/catch shape from `runEngine()` are reused. Phase 2 wraps the loop in a reconcile that also reports `EXPERIMENT_ERROR` to the SW.
- **`apps/extension/entrypoints/content-isolated.content.ts` (and `-main`)** — the bootstrap + STATE_CHANGED listener + cleanup Map already work end-to-end on ya.ru. Phase 2 swaps the inline manifest discovery for a `registry.json` fetch and adds error-reporting on `apply`/`cleanup` throws.
- **`apps/extension/entrypoints/background.ts`** — top-level listener pattern (SP-7) is correct as-is; Phase 2 just routes through the new typed handler split.
- **`apps/extension/entrypoints/popup/App.tsx`** — bare-bones `<input type="checkbox">` list; Phase 2 replaces this entirely with the shadcn shell (D-21..D-25). The `loadManifests()` helper goes away (replaced by `fetch(getURL('registry.json'))`).
- **`tools/build-experiments.ts`** — `scanAndValidate()`, `authorFromPath()`, ULID write-back, Zod validation; Phase 2 extends with `generateBundle` to emit `registry.json` keyed by chunk path.
- **`packages/experiment-sdk/src/index.ts`** — `ExperimentManifest`, `ApplyArgs`, `Helpers`, `ApplyFn`, `CleanupFn`; Phase 2 adds `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId`.
- **`apps/extension/wxt.config.ts`** — manifest declaration site; Phase 2 may add `web_accessible_resources: [{ resources: ['registry.json'], matches: ['*://*.ya.ru/*', '*://ya.ru/*'] }]` if the live verification shows that content-script `fetch(chrome.runtime.getURL('registry.json'))` from a content script context requires it. (Popup fetches from extension origin and does not need WAR.)
- **Vitest setup** (`apps/extension/vitest.config.ts`, `apps/extension/src/test-setup/chrome-mock.ts`) — already present; Phase 2 unit-tests follow the same conventions.

### Established Patterns

- **Top-level message listener (SP-7)** — `chrome.runtime.onMessage.addListener` (or its `@webext-core/messaging` equivalent) MUST be registered at module top so the listener exists in the SW global scope BEFORE Chrome dispatches the wake-up event after a ~30s idle. Verified end-to-end in Phase 1.
- **ZERO module-scope state in the SW (SP-1)** — every counter/flag goes to `chrome.storage.{local,session}`. Phase 2 extends this to all new handlers.
- **Per-call try/catch (SP-2)** — error in one experiment must not affect siblings; cleanup failures recorded but never bubble. Phase 2 adds the `EXPERIMENT_ERROR` report AFTER the catch.
- **Build-time discovery via `import.meta.glob` from the `@experiments` alias (SP-3)** — no runtime fetch of JS; CSP-safe. Phase 2 keeps this for module loaders, layers `registry.json` for metadata.
- **Idempotent JSON write-back** (`tools/build-experiments.ts` ULID stamp) — `JSON.stringify(v, null, 2) + '\n'`; Biome excludes `experiments/**/manifest.json` (Phase 1 D-17). Phase 2's `registry.json` follows the same shape (`+ '\n'` trailing newline).
- **TS path alias `@/*` and `@experiments`** — declared in both `tsconfig.json` and `wxt.config.ts` `vite.resolve.alias`. Phase 2 follows; do not introduce new aliases without updating both.

### Integration Points

- `apps/extension/entrypoints/popup/App.tsx` → completely rewritten (full shadcn shell + Zustand store); the new file imports nothing from the Phase 1 `App.tsx` body. The Phase 1 `loadManifests()` helper is removed.
- `apps/extension/entrypoints/background.ts` → keeps top-level listener registration; body delegates to typed handlers in `apps/extension/src/background/handlers/`.
- `apps/extension/entrypoints/content-isolated.content.ts` and `content-main.content.ts` → `bootstrap()` and `reconcile()` updated to (a) read `registry.json` for metadata, (b) report errors via `sendMessage('EXPERIMENT_ERROR', …)`, (c) write `applied:<tabId>` to `chrome.storage.session` after each reconcile completion.
- `tools/build-experiments.ts` → adds `generateBundle` with `this.emitFile({type: 'asset', fileName: 'registry.json', source})`; the existing `buildStart` hook (scan + ULID + Zod + author check) stays.
- `packages/experiment-sdk/src/index.ts` → additive type exports; no breaking changes for Phase 1 consumers.

### Greenfield → Brownfield Transition

Phase 1's PATTERNS.md described the repo as "greenfield — every file is new." That disclaimer no longer applies in Phase 2:
- Existing Phase 1 files are the closest-analog reference for any new file.
- Pattern lock-in is real now: file naming, alias usage, top-level listener, per-call try/catch, idempotent JSON, ULID-keyed storage — these are *enforced*, not aspirational.
- Phase 2 is not allowed to introduce a competing convention without an explicit deviation logged in the plan.

</code_context>

<specifics>
## Specific Ideas

- **`@webext-core/messaging` is the typed bus.** Phase 1's `messages.ts` already explicitly predicted this in a doc-comment; this is a "complete the prediction" decision, not a new direction. The library is maintained by the WXT author (`@aklinker1`), so compatibility is durable.
- **Author grouping is the primary organization** — alphabetical by author, with experiment count next to the author name. Phase 6's acceptance scenario (designer1, designer2, designer3 each with ≥1 experiment) is the visual target Phase 2 must already render correctly. The popup is built today as if 3 authors with 5 experiments each were the worst case; degrades gracefully to 1 author × 1 experiment (the current Phase 1 state with `experiments/andrew/smoke/`).
- **Status badge color palette** intentionally uses shadcn's existing `Badge` `variant`s rather than custom colors so the popup picks up theme changes for free. Color-blind safety: the badge always carries a label ("Off"/"Applied"/etc.), color is redundant.
- **Auto-disable is opinionated UX.** Toggle-off-then-on as the recovery path is intentional: it makes "I see the error, I want to retry" a single user gesture, no separate "Reset error counter" button. The line `Disabled after {count} errors in {windowSec}s — toggle off/on to re-enable.` is *the* affordance; the button is the toggle the user already knows.
- **`registry.json` as a hard-emitted asset** (not just a virtual module) is intentional — it's auditable from `apps/extension/.output/chrome-mv3/registry.json`, diff-friendly in PRs (the schema is stable), and unblocks Phase 5's "search by name/author/description" without a new index. The cost is one `fetch` round-trip on popup mount, which is sub-millisecond from extension origin.
- **The five status states are intentionally five, not six.** No "loading" state during initial reconcile — the popup either has data (subscribed to storage) or shows a one-line "Reading state…" while the first storage read is in flight (sub-50ms in practice). Avoids visual flicker.
- **Phase 6's `designer1/2/3` placeholder folders are NOT created in Phase 2.** Phase 2 ships the popup empty-state-friendly so a single `andrew/smoke` experiment renders correctly; Phase 6 acceptance criterion populates the team experiments.

</specifics>

<deferred>
## Deferred Ideas

The following came up while scoping Phase 2 and belong in other phases. Not lost — just not now.

- **Options page** (UI-01 mentions it alongside the popup) → Phase 4. The trigger is `HLP-01` (API-key UI for `llm()`); shipping an empty options page in Phase 2 adds maintenance for no value.
- **`Tooltip` and `Dialog`/`Sheet` shadcn components** → Phase 3 with the tweak system; Phase 2 deliberately keeps the component count small (Switch, Card, Collapsible, Badge, ScrollArea, Button).
- **URL-filtered popup view** (UI-05) → Phase 3. Phase 2 still computes `pending` vs `applied` using the active tab URL, but the visible row set is *all* experiments.
- **Drag-and-drop reorder** (ENG-09 / Phase 5).
- **Search by name/author/description** (UI-06 / Phase 5). The `registry.json` schema already supports this without rework.
- **Toolbar badge with active-experiment count on the current tab** (UI-07 / Phase 5).
- **Hot-reload `RE_APPLY_EXPERIMENT` message** (DX-01 / Phase 5). Phase 2 does NOT add this message type; the only re-apply trigger is `STATE_CHANGED` after a toggle.
- **SPA navigation re-evaluation** (ENG-07 / Phase 5). Phase 2 reconciles only on initial load + on `STATE_CHANGED`; `pushState` rewiring is a Phase 5 concern.
- **MutationObserver debounce + `data-exp-id` infinite-loop guard** (ENG-08 / Phase 5). The smoke experiment from Phase 1 already tags its style node `data-exp-id="smoke"`, so the convention exists; Phase 5 adds engine-level enforcement.
- **`chrome.storage.sync` / cross-device tweak sync** — explicitly v2 (`V2-UI-05`). Phase 2 uses local + session only.
- **Real circuit-breaker telemetry** (counts of auto-disables across sessions, per-experiment health) — would belong in Phase 5 dev-tools or v2 dashboards. Phase 2 just stores the latest state.
- **Yandex Browser smoke** of the new popup → Phase 6 (DIST-03). Phase 2 verifies on Chrome stable only.
- **`.crx` rebuild + GitHub Releases** (DIST-01 / Phase 6).
- **Tweak storage values** (`tweaks:<id>`) — Phase 2 reserves the key shape (D-28) but does not write any values; Phase 3 (TWK-07) lands the writer + reader.
- **Preset save/load to repo** (TWK-08 / Phase 5). Storage-key shape is reserved; no implementation.

### Considered, then explicitly NOT chosen
- **Push-style status updates** (SW → popup live message) — rejected (D-09): popup is rarely open, push requires the popup to be alive, storage-driven pull works without that constraint.
- **In-memory error window in the SW** — rejected (D-12): violates SP-1 (stateless SW); persistent window in `chrome.storage.session` is the correct shape.
- **Custom message-bus wrapper instead of `@webext-core/messaging`** — rejected (D-04): library is maintained by the WXT author; rolling our own is friction without payoff.
- **Object map `{[id]: RegistryEntry}` for `registry.json`** instead of an array — rejected (D-16): array is the natural representation in JSON, sort order is meaningful, `byId(registry, id)` covers O(1) lookup.
- **Auto-clear of auto-disable after a cooldown** — rejected (D-13): hidden state changes are confusing; toggle = user gesture is clearer.

</deferred>

---

*Phase: 02-state-foundation-messaging-popup-shell*
*Context gathered: 2026-04-25*
*Mode: --auto (Claude selected the recommended option for every decision)*
