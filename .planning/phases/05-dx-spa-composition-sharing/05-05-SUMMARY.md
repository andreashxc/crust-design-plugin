# Plan 05-05 Summary: Presets, Save Workflow, and Generated Descriptions

## Status

Completed on 2026-04-26.

## What Changed

- Added popup preset loading for experiments with `presets/*.json`.
- Preset values are validated through `validateTweakValues` before storage or reapply.
- Added a truthful popup save workflow: it copies a `corepack pnpm save-preset ...` command instead of claiming the extension wrote a repo file.
- Added `scripts/save-preset.ts` to write `experiments/<author>/<folder>/presets/<name>.json` with `{ name, values, updatedAt }`.
- Added `scripts/generate-descriptions.ts` and `corepack pnpm generate-descriptions`.
- Generated deterministic `description.md` files for current experiments; manual docs marked `generated: false` are skipped.
- Popup surfaces `Description missing` and `Description stale` warnings without blocking toggles.
- Added a real reference preset at `experiments/andrew/tweak-demo/presets/compact.json`.

## Verification

- `corepack pnpm save-preset andrew/tweak-demo compact '{"headline":"Hello"}'` passed and created a real preset file.
- `corepack pnpm generate-descriptions` passed and generated current experiment descriptions.
- `corepack pnpm vitest run tools/build-experiments.test.ts apps/extension/entrypoints/popup/App.test.tsx apps/extension/entrypoints/popup/components/TweakControls.test.tsx` passed: 56 tests.
- `corepack pnpm typecheck` passed.
- `corepack pnpm check-csp` passed.
- `corepack pnpm lint` passed with the two pre-existing reduced-motion `!important` warnings.

## Notes

- The popup does not write files directly because a browser extension cannot safely write into the repo. The copied command is the intended dev-mode bridge for now.
- `generate-descriptions` is explicit and not wired into every dev/build run, avoiding noisy repo rewrites.
