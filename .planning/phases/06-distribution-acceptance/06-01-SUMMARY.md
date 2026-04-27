# 06-01 Summary: Packaging Scripts and GitHub Release Workflow

## Completed

- Added root `corepack pnpm package:chrome`.
- Added `.github/workflows/release.yml` for `v*` tags.
- Documented GitHub Release sideload install flow in `docs/ONBOARDING.md`.

## Artifacts

`corepack pnpm package:chrome` emits:

- `apps/extension/.output/platformextension-0.0.0-chrome.zip`
- `apps/extension/.output/crust-chrome-mv3-unpacked.zip`

The workflow uploads all `.zip` files from `apps/extension/.output`.

## Notes

- The release path is intentionally zip-based for v1 sideload distribution.
- No `.crx` artifact is claimed or faked because the repo does not yet contain a configured release signing key.

## Verification

- `corepack pnpm package:chrome` passed.
- `corepack pnpm typecheck` passed.
- `corepack pnpm check-csp` passed.
- `corepack pnpm lint` passed with the existing reduced-motion `!important` warnings.
