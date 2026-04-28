# Phase 7 Manual Smoke: DESIGN.md Context Workflow

## Status

Status: PASSED for tooling and privacy smoke.

Date: 2026-04-28

## What Was Checked

1. Supplied ya.ru `DESIGN.md` parses from outside the repo.
2. Summary output is compact and contains the important site sections.
3. Local context paths are ignored by git by default.
4. Extension build does not include private context text.
5. Create/fork workflows expose context through a command hint, not by copying private files.

## Commands

```sh
corepack pnpm design-context --file /Users/andreas/Downloads/DESIGN.md
git check-ignore -v DESIGN.md design-context/ya.ru/DESIGN.md .crust/design-context/ya.ru/DESIGN.md
corepack pnpm exec vitest run
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm check-csp
corepack pnpm build
```

## Next Human Smoke

When creating the next real ya.ru experiment, ask the AI agent to run:

```sh
corepack pnpm design-context --url https://ya.ru/
```

Then verify visually that the experiment uses the site's spacing, typography, neutral colors, DOM anchors, and extension-safe patterns from the summary.

