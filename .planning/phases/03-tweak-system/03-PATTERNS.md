# Phase 3: Tweak System - Patterns

## Existing Codebase Patterns

### SDK Schema

- `packages/experiment-sdk/src/index.ts` owns the Zod schema and exported inferred types.
- Tests live beside it in `packages/experiment-sdk/src/*.test.ts`.
- Preserve Zod as a hard dependency of the SDK.

### Build Plugin

- `tools/build-experiments.ts` performs all manifest validation in `scanAndValidate()`.
- Registry emission is in `generateBundle()`.
- New manifest invariants belong in the scanner/build plugin so invalid experiments fail before WXT output.

### Storage

- `apps/extension/src/shared/storage.ts` is a thin async wrapper over `chrome.storage.local/session`.
- No module-scope mutable state in service-worker-facing storage helpers.
- Key constants live at the top of the file.
- Tests use the existing chrome mock.

### Messaging

- Use `@/shared/messages` typed protocol.
- SW listeners register at module top level.
- Content reports runtime experiment errors through `EXPERIMENT_ERROR`.
- Tweak validation errors should use storage helpers rather than overloading runtime error auto-disable.

### Popup

- `apps/extension/src/popup/store.ts` is Zustand slices.
- Pure logic lives under `apps/extension/src/popup/*.ts` with tests.
- React components live under `apps/extension/entrypoints/popup/components/`.
- Component tests use per-file jsdom pragma and React Testing Library.
- Use shadcn-compatible local primitives under `apps/extension/src/components/ui/`.

### Content Reconcile

- `content-isolated.content.ts` fetches `registry.json`, filters world/scope/auto-disabled/enabled, imports `entry.chunkPath`, and stores cleanup/controller per applied experiment.
- Module-scope maps are acceptable in content scripts because they are per document, not SW state.
- Cleanup runs before reapply.

## Phase 3 Rules

- Do not introduce per-experiment React code.
- Do not pass unvalidated tweak values to `apply()`.
- Do not store tweak values in repo; Phase 3 persistence is local only.
- Preserve existing Phase 2 status/error behavior.
- Keep popup layout dense; no nested cards.
- Use existing `matchesUrl` behavior as a compatibility wrapper while adding `matchesScope`.
- Shadow DOM proof should be narrow and testable; avoid broad helper architecture until Phase 4 helpers.
