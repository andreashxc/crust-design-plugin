# Phase 3 Manual Smoke Checklist

Automated validation is complete. Browser smoke is the remaining operator-visible check.

## Automated Results

- `corepack pnpm test -- --run` — 22 files, 177 tests passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed with one reduced-motion `!important` warning in popup CSS.
- `corepack pnpm check-csp` — passed.
- `corepack pnpm build` — passed.

## Build Artifact Capture

- Extension output: `apps/extension/.output/chrome-mv3/`
- Registry includes 3 experiments:
  - `tweak-demo` with 6 typed tweak definitions.
  - `smoke` with no tweaks.
  - `shadow-panel` with no tweaks.
- Built experiment chunks:
  - `chunks/experiments-andrew__tweak-demo-6de7f891.js`
  - `chunks/experiments-andrew__smoke-3416b9b8.js`
  - `chunks/experiments-andrew__shadow-panel-da3f51db.js`

## Manual Checklist

- [ ] Load `apps/extension/.output/chrome-mv3/` as an unpacked Chrome extension.
- [ ] Open `https://ya.ru/`.
- [ ] Open the popup and confirm only matching ya.ru experiments are shown.
- [ ] Enable `Tweak demo`.
- [ ] Change toggle/select/color/multi-select controls and confirm the page updates without reload.
- [ ] Change text and slider controls and confirm the page updates after debounce.
- [ ] Click Reset and confirm defaults return.
- [ ] Enable `Shadow panel` and confirm a panel appears.
- [ ] Inspect the panel host and confirm content is inside a ShadowRoot.
- [ ] Confirm host page sampled styles remain unchanged after enabling `Shadow panel`.

## Disposition

Manual browser smoke is pending Andrew's local Chrome verification.
