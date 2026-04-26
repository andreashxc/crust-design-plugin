# Phase 3: Tweak System - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Roadmap + Phase 1/2 implementation state

<domain>

## Phase Boundary

Phase 3 turns experiments from fixed code modules into manifest-driven configurable modules. The popup must render tweak controls from `manifest.json`, validate values before `apply()`, persist user values locally, and trigger a cleanup -> apply cycle without page reload.

In scope:

- `MAN-02`: URL scope supports Chrome match-patterns plus regex fallback.
- `TWK-01`: six tweak types: `toggle`, `select`, `text`, `number-slider`, `color`, `multi-select`.
- `TWK-02`: popup auto-renders shadcn controls from manifest declarations.
- `TWK-03`: values are validated before `apply()`; invalid values prevent apply and show popup error.
- `TWK-04`: text/number changes are debounced 250-500ms; toggle/select/color apply immediately.
- `TWK-05`: reset to manifest defaults.
- `TWK-06`: tweak changes trigger cleanup + apply without page reload.
- `TWK-07`: tweak values persist in `chrome.storage.local`, per user, not repo.
- `UI-02`: in-page UI experiments can mount inside Shadow DOM.
- `UI-05`: popup shows only experiments matching the active tab URL.

Out of scope:

- `TWK-08` presets saved to repo: Phase 5.
- Search, toolbar badge, drag/drop ordering, SPA navigation: Phase 5.
- LLM/fetch helpers and options page: Phase 4.
- Third-party advanced color picker registry: avoid unless the existing stack cannot support a minimal accessible color input.

</domain>

<decisions>

## Implementation Decisions

### Tweak Schema

- `packages/experiment-sdk/src/index.ts` is the single source of truth for tweak declarations and parsed manifest types.
- `ExperimentManifest.tweaks` changes from `unknown[]` to a Zod discriminated union.
- Every tweak has a stable `key`, human `label`, optional `description`, and `default`.
- Tweak keys are unique per experiment manifest; build-time validation rejects duplicates.
- `RegistryEntry.tweaks` exposes the typed declarations to popup/content.

### Tweak Values

- Runtime `ApplyArgs.tweaks` remains `Record<string, unknown>` for Phase 3; it receives validated values only.
- `tweaks:<ulid>` in `chrome.storage.local` stores user overrides only or a full effective value map; implementation may choose, but helpers must return effective values merged with defaults.
- Invalid stored values are not passed to experiments; validation errors are persisted under a popup-visible structure.
- Reset clears the stored values for the experiment and reapplies defaults.

### Reapply Contract

- Tweak changes are storage-driven. Popup writes storage and sends/broadcasts existing state-change messages; content scripts read current storage on reconcile.
- Content script owns cleanup/apply ordering. A new tweak value for an already-applied experiment must run cleanup first, then apply with the new validated values.
- Text-like high-frequency controls debounce before storage write; discrete controls write immediately.
- Existing error isolation and auto-disable semantics remain: failed apply/cleanup reports via `EXPERIMENT_ERROR`.

### URL Scope

- `matchesUrl` evolves to support `scope.regex` fallback while preserving Chrome match-pattern behavior.
- Regex strings are treated as untrusted manifest input: compile errors return `false` and are covered by tests/build validation where feasible.
- Popup filtering uses the same matcher as content reconcile.

### UI

- Popup remains dense and utilitarian. Tweak controls live inside the experiment row/details, not in a separate marketing-like page.
- Add only the shadcn/Radix primitives required for six controls.
- Color input may use native `<input type="color">` wrapped in local UI styling for Phase 3; no third-party color picker unless justified.
- Reset uses a clear button in the row; destructive confirmation is not required because reset is reversible through user input and limited to local values.

### Shadow DOM

- UI-02 is proven with a reference in-page panel experiment using WXT `createShadowRootUi`.
- Shadow DOM work should be isolated from popup tweak work. It must not leak Tailwind preflight or Radix portals into the host page.
- Verification snapshots a small set of host styles before/after extension load.

</decisions>

<canonical_refs>

## Canonical References

### Project Scope

- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and requirement IDs.
- `.planning/REQUIREMENTS.md` — canonical requirement text for MAN-02, TWK-01..07, UI-02, UI-05.
- `.planning/STATE.md` — Phase history and current completed Phase 2 state.

### Prior Phase Contracts

- `.planning/phases/01-foundation-spike-engine-skeleton/01-CONTEXT.md` — original manifest, engine, and URL-scope decisions.
- `.planning/phases/02-state-foundation-messaging-popup-shell/02-CONTEXT.md` — storage key reservations, popup status model, message protocol, registry contract.
- `.planning/phases/02-state-foundation-messaging-popup-shell/02-UI-SPEC.md` — popup visual system and components already installed.
- `.planning/phases/02-state-foundation-messaging-popup-shell/02-07-SUMMARY.md` — current content reconcile architecture.

### Source Files

- `packages/experiment-sdk/src/index.ts` — manifest schema, `ApplyArgs`, `RegistryEntry`.
- `tools/build-experiments.ts` — build-time manifest validation and registry emission.
- `apps/extension/src/shared/storage.ts` — local/session storage adapter.
- `apps/extension/src/shared/url-match.ts` — URL matching implementation.
- `apps/extension/src/popup/store.ts` — popup state slices.
- `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` — row UI integration point.
- `apps/extension/entrypoints/content-isolated.content.ts` — runtime apply/cleanup reconcile loop.

</canonical_refs>

<deferred>

## Deferred Ideas

- Repo presets (`TWK-08`) and preset UI.
- Advanced conditional tweak visibility.
- Cross-device sync.
- Full SPA navigation/reapply system.
- Options page and LLM counters.

</deferred>

---

*Phase: 03-tweak-system*
*Context gathered: 2026-04-26*
