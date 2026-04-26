---
phase: 02-state-foundation-messaging-popup-shell
plan: 05
subsystem: popup-shell
tags: [shadcn, tailwind-v4, zustand, popup-store, status, grouping]
completed: 2026-04-26
requirements-completed: [UI-01, UI-03]
blocked_by: []
---

# Phase 2 Plan 05: Popup UI Foundation Summary

Implemented the Phase 2 popup foundation: shadcn-compatible UI primitives, Tailwind v4 theme CSS, Zustand store slices, pure status computation, and author grouping.

## Accomplishments

- Added shadcn-compatible config at `apps/extension/components.json` (`new-york`, `slate`, CSS variables, lucide).
- Added `cn()` helper in `apps/extension/src/lib/utils.ts`.
- Added 6 UI primitives under `apps/extension/src/components/ui/`: `button`, `badge`, `card`, `collapsible`, `scroll-area`, `switch`.
- Added required dependencies: Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`.
- Updated `apps/extension/src/styles/popup.css` with Tailwind v4/shadcn tokens, 360px popup width, 560px max height, preserved Phase 1 body margin/padding/font, and reduced-motion handling.
- Added `apps/extension/src/popup/store.ts` with registry, storage, and active-tab slices.
- Added `apps/extension/src/popup/status.ts` with `computeStatus(...)` covering all 5 `ExperimentStatus` values.
- Added `apps/extension/src/popup/grouping.ts` with case-insensitive author sorting and active-tab `defaultOpen` calculation.
- Added 16 tests across `store.test.ts`, `status.test.ts`, and `grouping.test.ts`.

## Deviations

- The current `shadcn@latest` CLI prompts for preset selection even with `--template vite --base radix --yes --no-monorepo`, so the files were authored locally to match the planned shadcn contracts instead of relying on interactive CLI output.
- `tw-animate-css@1.4.0` exports CSS via the `style` condition only. Tailwind/Vite failed on `@plugin "tw-animate-css"`, so `popup.css` uses `@import "tw-animate-css"` instead. Build passes with this form.

## Verification

- `corepack pnpm vitest run apps/extension/src/popup/store.test.ts apps/extension/src/popup/status.test.ts apps/extension/src/popup/grouping.test.ts` — 3 files, 16 tests passed.
- `corepack pnpm test` — 16 files, 129 tests passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm lint` — passed with one warning for the UI-SPEC-required reduced-motion `!important`.
- `corepack pnpm -F @platform/extension build` — passed.

## Follow-up Resolution

The original 02-04 BLD-04 blocker was resolved later in Phase 2 by emitting experiment modules as web-accessible ESM assets from the build plugin and loading them with `chrome.runtime.getURL(entry.chunkPath)`.
