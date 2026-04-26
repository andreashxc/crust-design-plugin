# Plan 05-06 Summary: Onboarding, Empty States, and Update Banner

## Status

Completed on 2026-04-26.

## What Changed

- Added `docs/ONBOARDING.md` with clone/install/dev/load-unpacked/create/test/push-pull workflow.
- Added `docs/EXPERIMENT_AUTHORING.md` covering manifest structure, tweaks, helpers, presets, descriptions, and troubleshooting.
- Popup empty states now distinguish:
  - no registry/experiments
  - current page has no matching scope
  - search has no matching text
- Added persistent update-check state in `chrome.storage.local`.
- Added `UPDATE_CHECK` typed message and background handler.
- Update check uses the narrow GitHub compare endpoint for `andreashxc/overlay-plugin`.
- WXT manifest now grants GitHub API host access only for the compare endpoint.
- Popup shows a compact `Update available` banner only when cached update state is actionable.

## Verification

- `corepack pnpm vitest run apps/extension/src/shared/storage.test.ts apps/extension/entrypoints/popup/App.test.tsx apps/extension/src/background/**/*.test.ts` passed: 101 tests.
- `corepack pnpm typecheck` passed.
- `corepack pnpm build` passed.
- `corepack pnpm lint` passed with the two pre-existing reduced-motion `!important` warnings.

## Notes

- Network/update failures are cached as diagnostics but do not show a popup banner.
- If the build cannot embed a git commit, update check returns `{ ok: false }` and stays quiet.
