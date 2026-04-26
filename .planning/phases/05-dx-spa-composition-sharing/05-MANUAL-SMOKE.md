# Phase 5 Manual Smoke Checklist

## Setup

1. Run dev mode:

```sh
corepack pnpm dev
```

2. Load unpacked extension from:

```text
apps/extension/.output/chrome-mv3
```

3. Open:

```text
https://ya.ru/
```

## Checks

| # | Check | Pass | Fail | Notes |
|---|-------|------|------|-------|
| 1 | Edit an enabled `experiments/<author>/<folder>/experiment.ts`; reapply happens in `<2 seconds` without extension reload or tab-state loss. | [ ] | [ ] | |
| 2 | `pushState` / `replaceState` on ya.ru triggers scope re-evaluation: scope-out experiments clean up and scope-in experiments apply. | [ ] | [ ] | |
| 3 | Enable two experiments on one ya.ru tab; reorder in popup; order persists and applies after reapply/page refresh. | [ ] | [ ] | |
| 4 | Toolbar badge shows active count and hides at zero. | [ ] | [ ] | |
| 5 | Search filters rows; no-match and page-scope empty states are distinct and correct. | [ ] | [ ] | |
| 6 | Save/load a preset; Preset file exists at `experiments/<author>/<folder>/presets/<name>.json` or the explicit fallback command is truthful. | [ ] | [ ] | |
| 7 | Generated/stale `description.md` warnings appear for missing/stale generated docs and stay hidden for fresh/manual docs. | [ ] | [ ] | |
| 8 | Add a new designer folder under `experiments/<new-author>/<folder>/`; it appears after dev refresh/build. | [ ] | [ ] | |
| 9 | Open in Cursor opens the experiment folder, or copies the path when the deep link is unavailable. | [ ] | [ ] | |
| 10 | Update-available banner appears under a mocked newer remote and stays quiet on network failure. | [ ] | [ ] | |

## Result

Manual smoke status: pending Andrew/browser verification.
