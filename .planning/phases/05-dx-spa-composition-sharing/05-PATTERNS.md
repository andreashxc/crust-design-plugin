# Phase 5 Pattern Map

## Existing Patterns to Reuse

### Build-time discovery and generated registry

- `tools/build-experiments.ts` scans `experiments/*/*/manifest.json`, validates with SDK Zod schema, emits chunks and `registry.json`.
- Extend this file for presets, description metadata, dev source paths, and dev-refresh output. Do not create a second registry generator.

### Content reconcile loop

- `apps/extension/entrypoints/content-isolated.content.ts` owns enabled/scope/autodisable filtering, cleanup, dynamic import, apply, and applied-tab state.
- Extend this loop for apply order, chunkPath/module change detection, SPA URL re-evaluation, and dev hot reapply.

### Side-effect cleanup discipline

- `apps/extension/src/content/helpers.ts` tracks injected style/node/listener side effects and cleans them in reverse order.
- New observer/navigation utilities should follow the same cleanup shape.

### Popup state

- `apps/extension/src/popup/store.ts` is the Zustand root.
- `apps/extension/src/popup/grouping.ts` is the pure grouping/filtering layer.
- `apps/extension/src/popup/status.ts` computes status.
- Add pure helpers for search/order before wiring components.

### Storage helpers

- `apps/extension/src/shared/storage.ts` centralizes keys and typed wrappers.
- Add `experiment_order`, update-state, and preset-related helpers here.

### Background message handlers

- `apps/extension/entrypoints/background.ts` registers typed handlers at top level.
- Add new protocol messages in `apps/extension/src/shared/messages.ts` and small handler modules under `apps/extension/src/background/handlers/`.

## Files Expected to Change

- `packages/experiment-sdk/src/index.ts`
- `tools/build-experiments.ts`
- `tools/build-experiments.test.ts`
- `apps/extension/src/shared/storage.ts`
- `apps/extension/src/shared/storage.test.ts`
- `apps/extension/src/shared/messages.ts`
- `apps/extension/entrypoints/background.ts`
- `apps/extension/src/background/action-icon.ts`
- `apps/extension/src/background/broadcast.ts`
- `apps/extension/entrypoints/content-isolated.content.ts`
- `apps/extension/src/content/engine.ts`
- `apps/extension/src/content/*.test.ts`
- `apps/extension/src/popup/grouping.ts`
- `apps/extension/src/popup/store.ts`
- `apps/extension/entrypoints/popup/App.tsx`
- `apps/extension/entrypoints/popup/components/AuthorGroup.tsx`
- `apps/extension/entrypoints/popup/components/ExperimentRow.tsx`
- `apps/extension/entrypoints/popup/components/TweakControls.tsx`
- `apps/extension/entrypoints/popup/*.test.tsx`
- `scripts/create-experiment.ts`
- new scripts for descriptions/presets if needed
- `docs/ONBOARDING.md`
- `docs/EXPERIMENT_AUTHORING.md`

## Landmines

- MV3 cannot run arbitrary repo JS at runtime. Dev hot reapply must still import extension-origin chunks.
- Extension pages cannot silently write local repo files. Preset saving must use an honest dev bridge or explicit copy/download flow.
- Registry changes must be additive to avoid breaking existing popup/content tests.
- Global history patching must be installed once and restored only on content-script teardown, not per experiment.
- MutationObserver logic must ignore `[data-exp-id]` nodes or it can self-trigger loops.
- GitHub update checks require narrow permissions and graceful failure.
