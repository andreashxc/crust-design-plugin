# 06-02 Summary: Fork-to-My-Folder CLI and Popup Copy Command

## Completed

- Added `scripts/fork-experiment.ts`.
- Added root `corepack pnpm fork-experiment`.
- Added compact popup action that copies a truthful fork command.
- Documented the fork workflow in `docs/EXPERIMENT_AUTHORING.md`.

## Behavior

`corepack pnpm fork-experiment <source-id-or-author/folder> <target-author> [target-folder]`:

- finds source experiments by ULID or `author/folder`;
- copies `manifest.json`, `experiment.ts`, `description.md`, and `presets/`;
- rewrites `manifest.author`;
- clears `manifest.id` so the next dev refresh or rebuild stamps a new ULID;
- refuses to overwrite existing target folders.

The popup says "Fork command copied"; it does not claim to fork directly from the extension.

## Verification

- `corepack pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx` passed: 26 tests.
- CLI smoke in a temp repo passed: target `manifest.id` was `""` and `manifest.author` was `designer2`.
- `corepack pnpm typecheck` passed.
- `corepack pnpm check-csp` passed.
- `corepack pnpm lint` passed with the existing reduced-motion `!important` warnings.
