# 04-01 Summary: Helper Contracts And Storage Primitives

## Completed

- Extended the SDK helper contract with `llm`, `fetchPage`, `injectStyle`, `injectNode`, `waitFor`, and `onUrlChange`.
- Exported LLM provider/options/result/usage types, fetchPage result types, and helper cleanup-related types.
- Added storage helpers for provider keys, public LLM config, cache, session stats, diagnostics, and defaults.
- Added deterministic LLM cache-key normalization.

## Verification

- Covered by Phase 4 final validation in `04-08-SUMMARY.md`.
- Final gates passed: full tests, typecheck, lint, CSP, and build.

