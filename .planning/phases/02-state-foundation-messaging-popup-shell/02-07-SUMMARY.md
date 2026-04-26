---
phase: 02-state-foundation-messaging-popup-shell
plan: 07
subsystem: content-reconcile
tags: [content-script, registry-json, runtime-import, applied-tab, auto-disable, abort-signal]
completed: 2026-04-26
requirements-completed: [ENG-04, MAN-04]
---

# Phase 2 Plan 07: Content Reconcile Summary

Implemented the Phase 2 isolated-world reconcile loop using the generated registry and web-accessible experiment chunks.

## Accomplishments

- `content-isolated.content.ts` now fetches `registry.json` from the extension origin.
- Content script calls `WHO_AM_I` before first reconcile and writes `applied:<tabId>` after each reconcile.
- Experiments are filtered by `world`, auto-disabled state, enabled state, and URL scope before apply.
- Experiment modules are loaded with `import(chrome.runtime.getURL(entry.chunkPath))`.
- Apply and cleanup failures are reported through `EXPERIMENT_ERROR`, not direct storage writes.
- Cleanup now aborts the experiment `AbortController` before calling cleanup and ignores expected `AbortError`.
- `content-main.content.ts` is reduced to an empty MAIN-world stub because MAIN has no `chrome.*` API access.
- Added `filterAutoDisabled()` and `isAbortError()` content helpers.

## Verification

- `corepack pnpm vitest run apps/extension/src/content/error-isolation.test.ts apps/extension/src/content/abort-signal.test.ts` — passed.
- `corepack pnpm -F @platform/extension compile` — passed.
- `corepack pnpm -F @platform/extension build` — passed.
