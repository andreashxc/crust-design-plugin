# Phase 6: Distribution & Acceptance - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 makes Crust v1 shippable for a closed team. It covers release packaging, GitHub release artifacts, the v1 fork-to-my-folder flow, acceptance fixture experiments for three designers, browser sideload smoke, and final acceptance evidence.

This phase does not add Chrome Web Store distribution, cloud sync, runtime remote code loading, or automatic browser update infrastructure. Sideload remains the distribution model.

</domain>

<decisions>
## Implementation Decisions

### Packaging and releases
- `corepack pnpm build` remains the source of the unpacked Chromium MV3 build at `apps/extension/.output/chrome-mv3`.
- Root scripts should expose package/release commands so users do not need to remember workspace-specific WXT commands.
- WXT's `zip` command should be used for zip artifacts. If a true `.crx` requires a private signing key, v1 must document the required secret and produce the unsigned zip/unpacked artifacts in CI rather than faking a `.crx`.
- GitHub release workflow should run only on tags and upload deterministic artifacts from CI.

### Forking
- v1 fork flow is clipboard + shell command, not File System Access API.
- Popup UI must be honest: "Copy fork command", not "Forked", unless a real file copy has happened.
- The command should target `scripts/fork-experiment.ts <source-author>/<source-folder-or-id> <target-author> [target-folder]`.
- Forked manifests must get a new stable ID on the next build so local storage does not collide with the source experiment.

### Acceptance fixtures
- Add `designer1`, `designer2`, and `designer3` folders under `experiments/`.
- Fixtures must cover: one LLM experiment, one `fetchPage` experiment, one experiment with at least three tweak types, and a composition scenario on ya.ru.
- Fixtures should stay small and deterministic so they are useful test artifacts, not demo clutter.

### Browser smoke
- Chrome and Yandex Browser smoke are manual acceptance gates because browser sideload behavior cannot be fully verified in jsdom/Vitest.
- Manual docs must include exact load-unpacked path, expected popup behavior, and pass/fail checklist.

### the agent's Discretion
- Exact script names, artifact filenames, and GitHub workflow job names.
- Whether fork command accepts source by `author/folder`, ULID, or both.
- Fixture experiment copy and visual details, as long as requirement coverage is explicit.

</decisions>

<canonical_refs>
## Canonical References

### Product and requirements
- `.planning/PROJECT.md` — v1 closed-team sideload model and three-designer acceptance scenario.
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, and requirement mapping.
- `.planning/REQUIREMENTS.md` — BLD-06, SHR-03, DIST-01, DIST-03, ACC-01..ACC-07.

### Existing implementation
- `apps/extension/package.json` — WXT build/zip scripts.
- `package.json` — root command surface.
- `.github/workflows/ci.yml` — existing CI pattern and Node/pnpm setup.
- `apps/extension/wxt.config.ts` — manifest permissions and artifact target.
- `apps/extension/entrypoints/popup/App.tsx` and `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` — popup action surface.
- `scripts/create-experiment.ts`, `scripts/save-preset.ts`, `scripts/generate-descriptions.ts` — CLI patterns for repo file operations.
- `experiments/andrew/*` — reference experiments for smoke, tweaks, helpers, and Shadow DOM.
- `docs/ONBOARDING.md` and `docs/EXPERIMENT_AUTHORING.md` — user-facing setup and authoring docs.

</canonical_refs>

<specifics>
## Specific Ideas

- Root scripts likely needed: `package:chrome`, `release:zip`, maybe `fork-experiment`.
- Release workflow should upload:
  - unpacked extension zip
  - WXT zip artifact
  - optional sources zip if useful
- Fork UI can sit near existing Open in Cursor / preset command actions; keep the Crust compact style.
- Acceptance smoke should be explicit about what is automated and what Andrew must verify in real browsers.

</specifics>

<deferred>
## Deferred Ideas

- Chrome Web Store release.
- Automatic CRX signing without a configured private key.
- Direct browser file writes from popup.
- Full visual conflict-resolution UI for composed experiments.

</deferred>

---

*Phase: 06-distribution-acceptance*
*Context gathered: 2026-04-27*
