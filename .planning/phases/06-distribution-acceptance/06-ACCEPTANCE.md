# Phase 6 Acceptance Report

Date: 2026-04-27

## Verdict

Phase 6 is complete locally for automated validation and release-candidate artifact generation.

Release publication is blocked by local GitHub SSH authentication, not by code: `git push origin main` fails with `Permission denied (publickey)`.

Manual Chrome/Yandex Browser sideload smoke is documented in `06-MANUAL-SMOKE.md` and remains pending operator execution.

## Automated Gates

| Gate | Result |
|------|--------|
| `corepack pnpm test -- --run` | Passed: 32 files, 264 tests |
| `corepack pnpm typecheck` | Passed |
| `corepack pnpm lint` | Passed with 2 existing reduced-motion `!important` warnings |
| `corepack pnpm check-csp` | Passed |
| `corepack pnpm build` | Passed |
| `corepack pnpm package:chrome` | Passed |

Known lint warnings:

- `apps/extension/src/styles/options.css:323`
- `apps/extension/src/styles/popup.css:101`

## Artifacts

| Artifact | Size | Notes |
|----------|------|-------|
| `apps/extension/.output/chrome-mv3/manifest.json` | 1.0K | MV3 manifest for load unpacked |
| `apps/extension/.output/chrome-mv3/registry.json` | 5.4K | 7 registry entries |
| `apps/extension/.output/platformextension-0.0.0-chrome.zip` | 199K | WXT Chrome zip |
| `apps/extension/.output/crust-chrome-mv3-unpacked.zip` | 202K | Unpacked-folder zip for sideload install |

Manifest host permissions remain scoped to ya.ru plus the GitHub compare endpoint:

- `*://ya.ru/*`
- `*://*.ya.ru/*`
- `https://api.github.com/repos/andreashxc/overlay-plugin/compare/*`

## Requirement Evidence

| Requirement | Status | Evidence |
|-------------|--------|----------|
| BLD-06 | Partial | `pnpm build` produces `apps/extension/.output/chrome-mv3`; signed `.crx` is not produced because no signing key is configured. Zip-based sideload artifacts are produced honestly. |
| SHR-03 | Passed | `corepack pnpm fork-experiment` plus popup copy command; CLI smoke confirmed author rewrite and empty id before restamp. |
| DIST-01 | Partial | GitHub release workflow and zip artifacts exist; signed `.crx` remains deferred until signing key setup. |
| DIST-03 | Pending manual | Yandex Browser smoke checklist exists in `06-MANUAL-SMOKE.md`; real browser execution pending. |
| ACC-01 | Passed | Registry includes `designer1`, `designer2`, `designer3`, each with one fixture. |
| ACC-02 | Passed | `designer3/ai-label` uses `helpers.llm()`. |
| ACC-03 | Passed | `designer2/page-summary` uses `helpers.fetchPage()`. |
| ACC-04 | Automated passed, manual pending | `designer1/acceptance-banner` has 4 tweak controls; browser tweak smoke pending. |
| ACC-05 | Automated passed, manual pending | Fork CLI and popup command are tested; end-to-end browser copy/run/rebuild smoke pending. |
| ACC-06 | Automated covered, manual pending | Fixture overlays use unique `data-exp-id`; reorder/composition browser smoke pending. |
| ACC-07 | Pending manual | Chrome/Yandex load-unpacked and `<15 minutes` onboarding smoke pending. |

## Registry Snapshot

- Total entries: 7
- Authors: `designer3`, `designer2`, `designer1`, `andrew`
- Acceptance fixture chunks:
  - `chunks/experiments-designer1__acceptance-banner-09ac20f6.js`
  - `chunks/experiments-designer2__page-summary-dbbec508.js`
  - `chunks/experiments-designer3__ai-label-36813096.js`

## Follow-Up

1. Fix GitHub SSH auth and push local commits.
2. Execute `06-MANUAL-SMOKE.md` in Chrome and Yandex Browser.
3. Add release tag after manual smoke passes.
