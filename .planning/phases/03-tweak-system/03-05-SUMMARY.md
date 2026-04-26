---
phase: 03-tweak-system
plan: 03-05
subsystem: reference-experiments
tags: [experiment, tweaks, shadow-dom]
completed: 2026-04-26
requirements-completed: [UI-02, TWK-01, TWK-06]
---

# Phase 3 Plan 05: Reference Experiments Summary

Added reference experiments for the Phase 3 user journey.

## Accomplishments

- Added `experiments/andrew/tweak-demo` with all six tweak types and a configurable banner.
- Added `experiments/andrew/shadow-panel` with a native ShadowRoot panel and no global style injection.
- Added `shadow-dom.test.ts` to assert the Shadow DOM experiment uses a shadow root and avoids `document.head.append`.

## Verification

- `corepack pnpm vitest run apps/extension/src/content/shadow-dom.test.ts` — passed.
- `corepack pnpm -F @platform/extension build` — passed.
