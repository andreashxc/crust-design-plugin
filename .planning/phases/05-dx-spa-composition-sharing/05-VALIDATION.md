# Phase 5 Validation Strategy

## Automated Gates

- `corepack pnpm test -- --run`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm check-csp`
- `corepack pnpm build`

## Required Unit Coverage

- Registry emits additive metadata for presets, source directory, description status, and source signatures.
- Storage helpers cover experiment order, presets/update state, and malformed data defaults.
- Content helpers cover URL change detection, debounce, module/chunk change reapply, ordered apply, and self-mutation filtering.
- Background helpers cover badge hidden-zero behavior and update-check success/failure states.
- Popup helpers cover search, grouping, order sorting, and preset menu state.

## Required Component Coverage

- Popup search filters by name, author, description.
- Author groups hide when all rows are filtered.
- Reorder buttons persist order and dispatch state change.
- Preset load/save states render without nested cards.
- Open in Cursor button appears only when `sourceDir` metadata exists.
- Update banner appears only for newer remote version.

## Manual Smoke

Create `.planning/phases/05-dx-spa-composition-sharing/05-MANUAL-SMOKE.md` with checks for:

1. `pnpm dev`; edit enabled `experiment.ts`; reapply happens in <2 seconds without extension reload.
2. `pushState`/`replaceState` on ya.ru causes cleanup/apply according to scope.
3. Enable two experiments; reorder in popup; order persists and applies after reapply/page refresh.
4. Toolbar badge shows active count and hides at zero.
5. Search filters rows and no-match/page-scope empty states are correct.
6. Save/load a preset and verify a repo file exists or the explicit fallback flow is truthful.
7. Generated/stale `description.md` warnings behave as specified.
8. New designer folder appears after dev refresh/build.
9. Open in Cursor works or copies the path.
10. Update-available banner appears under a mocked newer remote and stays quiet on network failure.

## Risk Checks

- Production build must not include dev-only polling unless guarded by `import.meta.env.DEV`.
- New permissions for update checks must be narrow and visible in manifest diff.
- Preset saving must not claim file-write success unless a file exists on disk.
