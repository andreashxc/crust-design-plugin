---
phase: 03-tweak-system
plan: 03-03
subsystem: popup-integration
tags: [popup, zustand, storage-sync, scope-filter, reset]
completed: 2026-04-26
requirements-completed: [TWK-02, TWK-03, TWK-05, TWK-07, UI-05]
---

# Phase 3 Plan 03: Popup Integration Summary

Integrated tweak controls into the live popup.

## Accomplishments

- Added tweak values and tweak errors to the popup Zustand store.
- Bootstrapped tweak values/errors from `chrome.storage.local`.
- Synced `tweaks:<id>` and `tweak_errors:<id>` through `chrome.storage.onChanged`.
- Filtered popup rows to the active tab URL using `matchesScope(...)`.
- Wired `ExperimentRow` to validate, persist, reset, and broadcast tweak changes.
- Added `TWEAKS_CHANGED` message handled by the service worker through `broadcastStateChanged()`.

## Verification

- `corepack pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx apps/extension/src/popup/grouping.test.ts apps/extension/src/popup/store.test.ts` — passed.
- `corepack pnpm typecheck` — passed.
