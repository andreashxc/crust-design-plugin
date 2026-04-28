# 04-04 Summary: Content Helper Factory And Cleanup Ledger

## Completed

- Added content-side helper factory used by experiment `apply()` calls.
- Wired `helpers.llm` through the typed background message path.
- Added auto-tracked side-effect cleanup for injected styles, nodes, observers, and URL-change callbacks.
- Added abort-aware cleanup behavior and idempotent cleanup handling.
- Added per-experiment apply rate limiting to reduce hot-loop and LLM runaway risk.

## Verification

- Covered by Phase 4 final validation in `04-08-SUMMARY.md`.
- Helper cleanup and content reconcile tests passed in the full suite.

