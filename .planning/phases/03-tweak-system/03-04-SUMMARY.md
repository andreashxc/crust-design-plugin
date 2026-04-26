---
phase: 03-tweak-system
plan: 03-04
subsystem: content-reconcile
tags: [content-script, reapply, cleanup, validation]
completed: 2026-04-26
requirements-completed: [TWK-03, TWK-06, TWK-07]
---

# Phase 3 Plan 04: Content Reapply Summary

Made the content-script reconcile loop tweak-aware.

## Accomplishments

- Content reconcile now reads stored tweak values, validates them, and passes validated values into `apply({ tweaks })`.
- Applied experiments track a stable tweak value key.
- Changed tweak values trigger abort + cleanup, then apply with the new values.
- Invalid values are stored as tweak validation errors and never reach experiment code.
- Scope checks now use `matchesScope(...)` with regex fallback.

## Verification

- `corepack pnpm vitest run apps/extension/src/content/tweaks.test.ts apps/extension/src/content/error-isolation.test.ts apps/extension/src/content/abort-signal.test.ts` — passed.
- `corepack pnpm -F @platform/extension compile` — passed.
