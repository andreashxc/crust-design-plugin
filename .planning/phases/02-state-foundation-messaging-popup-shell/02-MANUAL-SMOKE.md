# Phase 2 Manual Smoke Checklist

Automated validation is complete. Browser smoke remains the operator-visible confirmation step for the unpacked MV3 extension.

## Automated Results

- `corepack pnpm test -- --run` — 18 files, 139 tests passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed with one reduced-motion `!important` warning in popup CSS.
- `corepack pnpm check-csp` — passed.
- `corepack pnpm build` — passed.

## Build Artifact Capture

- Extension output: `apps/extension/.output/chrome-mv3/`
- `registry.json` includes one smoke entry with `chunkPath: "chunks/experiments-andrew__smoke-3416b9b8.js"`.
- `manifest.json` exposes `registry.json` and `chunks/experiments-*.js` via `web_accessible_resources`.
- Built content scripts:
  - `content-scripts/content-isolated.js`
  - `content-scripts/content-main.js`
- Built experiment chunk:
  - `chunks/experiments-andrew__smoke-3416b9b8.js`

## Manual Checklist

- [ ] Load `apps/extension/.output/chrome-mv3/` as an unpacked Chrome extension.
- [ ] Open `https://ya.ru/`, then open the extension popup and confirm `Smoke pink` appears under `andrew`.
- [ ] Toggle `Smoke pink` on and confirm the page turns pink and popup status becomes `Applied`.
- [ ] Toggle `Smoke pink` off and confirm the page returns to normal and popup status becomes `Off`.
- [ ] Trigger or inject an experiment error and confirm popup shows `Error` or `Auto-disabled` with an expandable stack trace.

## Disposition

Manual browser smoke is not executed in this headless Codex run. The build artifacts and automated checks are ready for local Chrome verification.
