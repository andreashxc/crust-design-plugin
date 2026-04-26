---
phase: 03-tweak-system
plan: 03-01
subsystem: sdk-storage-scope
tags: [tweaks, sdk, storage, url-scope, build-validation]
completed: 2026-04-26
requirements-completed: [TWK-01, TWK-03, TWK-07, MAN-02]
---

# Phase 3 Plan 01: SDK, Storage & Scope Summary

Implemented the typed tweak foundation.

## Accomplishments

- Replaced opaque SDK `tweaks` with a Zod discriminated union for `toggle`, `select`, `text`, `number-slider`, `color`, and `multi-select`.
- Exported `TweakDefinition`, `TweakValueMap`, `TweakValidationError`, `TweakValueValidationError`, and value helpers.
- Added local storage helpers for `tweaks:<id>` and `tweak_errors:<id>`.
- Added `matchesScope(...)` with regex fallback while preserving `matchesUrl(...)`.
- Added build-time duplicate tweak key rejection.

## Verification

- `corepack pnpm vitest run packages/experiment-sdk/src/manifest.test.ts apps/extension/src/shared/storage.test.ts apps/extension/src/shared/url-match.test.ts tools/build-experiments.test.ts` — passed.
- `corepack pnpm typecheck` — passed.
