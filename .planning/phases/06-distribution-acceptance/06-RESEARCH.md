# Phase 6 Research: Distribution & Acceptance

## Packaging

- WXT 0.20.25 exposes `wxt build` and `wxt zip`.
- Current workspace already has `@platform/extension` scripts:
  - `build`: `wxt build`
  - `zip`: `wxt zip`
- Root `corepack pnpm build` already produces the unpacked extension at `apps/extension/.output/chrome-mv3`.
- A true `.crx` normally requires signing material. Do not claim `.crx` output unless the repo has a reproducible signing path or CI secret contract.

## GitHub Releases

- Existing CI uses GitHub Actions, Node 24, pnpm 10.33.2, frozen lockfile, and runs lint/typecheck/test/CSP/build.
- Release workflow can reuse this setup and trigger on tags like `v*`.
- Artifact upload should be implemented even before final signing, with artifact names stable enough for docs.

## Fork Flow

- Existing popup already copies truthful commands for preset saving and opens source folders when `sourceDir` is available.
- A fork flow should follow the same pattern: command copy in popup, repo mutation in CLI script.
- Source lookup should support `author/folder` and ULID for resilience.
- Fork command should copy experiment files, remove generated artifacts only if needed, reset `manifest.id` to empty, and update `manifest.author`.

## Acceptance Fixtures

- Current repo only has `experiments/andrew/*`; Phase 6 must add designer folders.
- Existing `helper-demo` already exercises `helpers.llm` and `helpers.fetchPage`; it can be copied/adapted into one of the designer fixtures.
- Existing `tweak-demo` already exercises 5 tweak controls; it can be adapted for ACC-04.

## Browser Smoke

- Chrome/Yandex sideload is manual. Automated gates can verify build artifacts, manifest permissions, registry shape, fork script behavior, and popup command generation.
- Manual smoke docs should include exact commands and pass/fail tables.

## Risks

- CRX signing can become a blocker if treated as mandatory before secrets exist.
- Fork script can accidentally copy source IDs and collide with existing storage.
- Acceptance fixtures can become noisy if they are not scoped and documented.
