# Phase 6 Validation Strategy

## Automated Gates

- `corepack pnpm test -- --run`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm check-csp`
- `corepack pnpm build`
- `corepack pnpm -F @platform/extension zip`

## Required Unit Coverage

- Fork script copies an experiment to another author folder and resets `manifest.id`.
- Fork script refuses to overwrite an existing target unless explicitly supported by a safe flag.
- Popup copy-fork command includes `corepack pnpm fork-experiment`.
- Release/build scripts produce expected artifact paths.
- Acceptance fixture registry includes designer1, designer2, designer3.

## Build Artifact Checks

- Unpacked extension exists at `apps/extension/.output/chrome-mv3`.
- WXT zip artifact exists after packaging.
- Manifest contains no broad host permission added for release work.
- Registry includes all acceptance fixture experiments.

## Manual Smoke

Create `06-MANUAL-SMOKE.md` with checks for:

1. Chrome load-unpacked from release artifact.
2. Yandex Browser load-unpacked from release artifact.
3. Fork command copied from popup and run locally.
4. Forked experiment appears after rebuild/dev refresh.
5. Three-designer fixture scenario: designer1 + designer2 compose on ya.ru and reorder.
6. LLM fixture behavior with missing key warning and configured key smoke.
7. `fetchPage` fixture behavior on ya.ru.
8. New user onboarding completes in under 15 minutes.

## Acceptance Report

Final plan should write `06-ACCEPTANCE.md` recording:

- automated gate results
- artifact paths
- browser smoke status
- known limitations
- release readiness verdict
