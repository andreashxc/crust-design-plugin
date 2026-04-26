---
phase: 03
slug: tweak-system
status: draft
created: 2026-04-26
---

# Phase 3 Validation Strategy

## Gates

| Gate | Requirement | Command / Check |
|------|-------------|-----------------|
| SDK schema | TWK-01, TWK-03 | `corepack pnpm vitest run packages/experiment-sdk/src/manifest.test.ts` |
| Build validation | TWK-01, BLD compatibility | `corepack pnpm vitest run tools/build-experiments.test.ts` |
| Storage + matcher | TWK-07, MAN-02 | `corepack pnpm vitest run apps/extension/src/shared/storage.test.ts apps/extension/src/shared/url-match.test.ts` |
| Popup renderer | TWK-02, TWK-04, TWK-05, UI-05 | `corepack pnpm vitest run apps/extension/src/popup/*.test.ts apps/extension/entrypoints/popup/App.test.tsx` |
| Content reapply | TWK-03, TWK-06 | `corepack pnpm vitest run apps/extension/src/content/*.test.ts` |
| Full suite | All | `corepack pnpm test -- --run && corepack pnpm typecheck && corepack pnpm lint && corepack pnpm check-csp && corepack pnpm build` |

## Manual Smoke

- Load `apps/extension/.output/chrome-mv3` unpacked.
- Open `https://ya.ru/`.
- Confirm popup only shows matching experiments.
- Enable a reference experiment with at least 3 tweak types.
- Change toggle/select/color and confirm immediate page update.
- Change text/slider and confirm debounced page update without reload.
- Reset to defaults and confirm page reflects defaults.
- Enable Shadow DOM reference experiment and confirm host sampled styles are unchanged.
