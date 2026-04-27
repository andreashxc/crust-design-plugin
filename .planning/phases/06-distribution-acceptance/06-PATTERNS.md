# Phase 6 Patterns

## CLI Scripts

Existing scripts use `tsx`, read from `process.cwd()`, validate manifests with `ExperimentManifest`, and print truthful file paths:

- `scripts/create-experiment.ts`
- `scripts/save-preset.ts`
- `scripts/generate-descriptions.ts`

Use the same pattern for `scripts/fork-experiment.ts`.

## Popup Actions

`ExperimentRow.tsx` already handles:

- optimistic toggle
- copy/open source action
- copy preset save command
- concise inline status strings

Fork UI should reuse this compact action style and never claim a repo write from the browser.

## Registry Metadata

Build metadata already includes:

- `author`
- `folder`
- dev-only `sourceDir`
- `sourceSignature`
- `presets`
- `descriptionStatus`

Fork command generation can use `author/folder`; source opening can keep using `sourceDir`.

## Workflow Files

`.github/workflows/ci.yml` is the model for setup:

- `actions/checkout@v4`
- `pnpm/action-setup@v4`
- Node 24
- `pnpm install --frozen-lockfile`

Release workflow should mirror this instead of inventing separate setup.

## Manual Smoke Artifacts

Previous phases place manual checklists under `.planning/phases/<phase>/`.
Phase 6 should create `06-MANUAL-SMOKE.md` and an acceptance report, not rely on final chat messages as the only record.
