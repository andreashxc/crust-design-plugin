# 06-04 Summary: Chrome/Yandex Sideload Manual Smoke Checklist

## Completed

- Added `.planning/phases/06-distribution-acceptance/06-MANUAL-SMOKE.md`.
- Tightened `docs/ONBOARDING.md` so dev install and release install are distinct.

## Checklist Coverage

- Chrome load unpacked path.
- Yandex Browser load unpacked path.
- Unpacked dev path and release artifact path.
- Fork, composition, LLM missing/configured key, `fetchPage`, tweak controls, and onboarding `<15 minutes` rows.

## Verification

- `corepack pnpm lint` passed with the existing reduced-motion `!important` warnings.
- `corepack pnpm typecheck` passed.
- Acceptance text check passed for `Yandex Browser`, `load unpacked`, and `<15 minutes`.
