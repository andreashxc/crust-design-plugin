# 06-03 Summary: Three-Designer Acceptance Fixture Experiments

## Completed

- Added `experiments/designer1/acceptance-banner`.
- Added `experiments/designer2/page-summary`.
- Added `experiments/designer3/ai-label`.
- Documented the fixture set in `docs/EXPERIMENT_AUTHORING.md`.
- Extended `tools/build-experiments.test.ts` to assert fixture author presence, ya.ru scope, tweak coverage, and helper usage.

## Coverage

- `designer1/acceptance-banner`: four tweak controls and a composable fixed overlay.
- `designer2/page-summary`: uses `helpers.fetchPage()`.
- `designer3/ai-label`: uses `helpers.llm()`.
- All fixtures use unique `data-exp-id` values for composition smoke.

## Verification

- `corepack pnpm vitest run tools/build-experiments.test.ts` passed: 28 tests.
- `corepack pnpm typecheck` passed.
- `corepack pnpm build` passed and emitted chunks for all three designer fixtures.
- `corepack pnpm lint` passed with the existing reduced-motion `!important` warnings.
