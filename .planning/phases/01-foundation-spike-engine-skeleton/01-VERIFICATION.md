---
phase: 01-foundation-spike-engine-skeleton
verified: 2026-04-25T21:35:00Z
status: passed
score: 5/5 must-haves verified — 3 automated + 2 live-Chrome (Andrew's session 2026-04-25). One bug caught during the live smoke (chrome.* call in MAIN world content script); fixed in commit cf6ff10; both manual tests then passed cleanly.
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load unpacked extension in Chrome and observe ya.ru smoke apply + revert"
    expected: |
      1. pnpm -F @platform/extension build (already green)
      2. chrome://extensions → Developer mode → Load unpacked → apps/extension/.output/chrome-mv3/
      3. Open https://ya.ru/ — page renders normally (not pink)
      4. Click extension icon → popup shows "Smoke pink by andrew" with unchecked checkbox
      5. Toggle ON → page background turns pink within ~1-2 seconds (via injected <style data-exp-id="smoke">)
      6. Toggle OFF → background reverts cleanly (cleanup removes the style element)
      7. Page DevTools console shows no red errors prefixed [engine] or [exp]
    why_human: |
      Roadmap Success Criterion #1 is an empirical claim about real Chrome behavior. The
      Plan 05 SW-restart smoke checklist was auto-approved under chained-run --auto mode
      (10 [x] checkboxes in docs/spike/MV3-FOUNDATION.md were marked without a literal
      browser session — explicitly disclosed in 01-05-SUMMARY.md "Human-Verify Outcome"
      and in the spike doc itself). Structural prerequisites (built manifest with
      content_scripts ISOLATED+MAIN, smoke bundled into content-isolated.js with
      "background: pink", popup wired to chrome.runtime.sendMessage EXPERIMENT_TOGGLE,
      stateless storage, top-level listener at line 20 < defineBackground line 53) are
      all verified, but only Andrew's local Chrome run can confirm the live apply/cleanup
      cycle.
  - test: "Service worker survives chrome://serviceworker-internals Stop and still applies/cleans up correctly"
    expected: |
      1. With extension loaded and ya.ru open, toggle smoke ON (page pink), then OFF (revert).
      2. Open chrome://serviceworker-internals → find the extension's SW → click Stop.
      3. SW row shows STOPPED.
      4. Re-open the popup. Toggle smoke ON again.
      5. Page background turns pink again — proves the SW woke from cold start, the
         top-level chrome.runtime.onMessage.addListener fired before defineBackground main(),
         storage was read fresh from chrome.storage.local, and STATE_CHANGED was broadcast.
      6. Toggle OFF → reverts cleanly.
    why_human: |
      Roadmap Success Criterion #5 (SW holds zero in-memory state; restart via
      chrome://serviceworker-internals "stop" still produces correct apply/cleanup) is
      a runtime-only behavior that the unit tests cannot reach. The structural
      prerequisites are in place — apps/extension/src/shared/storage.ts has zero
      module-scope mutable state (verified via grep '^let ' = 0) and the listener-order
      contract is verified by line numbers — but the actual "stop and re-trigger"
      empirical confirmation must be performed by Andrew in his local Chrome session.
      Plan 05 records this as the durable verification gate.
overrides:
  []
---

# Phase 1: Foundation Spike & Engine Skeleton Verification Report

**Phase Goal:** A loadable Chromium MV3 extension exists with a validated engine architecture (SW lifecycle, world routing, Shadow DOM) and one smoke experiment that applies and cleans up correctly. The riskiest MV3 unknowns are empirically resolved before any feature work begins.

**Verified:** 2026-04-25T21:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Extension loads via "load unpacked" in Chrome and a smoke experiment turns ya.ru pink, then reverts cleanly when disabled | ⚠ STRUCTURAL ✓ / EMPIRICAL ?  | Built `apps/extension/.output/chrome-mv3/manifest.json` is MV3-valid with `content_scripts` (2 entries, ISOLATED + MAIN) targeting `*://*.ya.ru/*` + `*://ya.ru/*`. Smoke bundled into `content-scripts/content-isolated.js` (`grep -c 'background: pink'` = 1; `grep -c 'smoke'` = 1+). Popup `App.tsx` calls `chrome.runtime.sendMessage({type:'EXPERIMENT_TOGGLE', id, enabled})`; SW `background.ts:20` handles via `setEnabledExperiment`; content script `content-isolated.content.ts:74-80` listens to `STATE_CHANGED` and runs `reconcile`, which applies/cleans up via the smoke's `apply` function. **Live-browser confirmation deferred to human verification** (Plan 05 auto-approved without literal Chrome run). |
| 2 | `docs/spike/MV3-FOUNDATION.md` is committed documenting verified-vs-broken behaviors for: WXT vs CRXJS reconciliation, content-script HMR, dynamic-import cache-busting, SW idle-termination behavior, isolated-world vs MAIN-world routing | ✓ VERIFIED | File exists at `docs/spike/MV3-FOUNDATION.md`, 163 lines (≥ 80 threshold). All 5 mandated section headings present (`## 1. WXT vs CRXJS reconciliation` through `## 5. Two-world routing`). Plus `## SW Restart Smoke Checklist (D-27)`, `## Open Questions Resolved`, `## Sign-off`. `grep -E '(TBD|TODO|<EXEC:)'` returns zero matches (all placeholders resolved). 10 `^- \[x\]` smoke checklist boxes (matches D-27 10-step requirement). |
| 3 | Build pipeline discovers experiments under `experiments/<author>/<id>/` via `import.meta.glob`, validates manifests with Zod, fails the build with a readable error on schema violation | ✓ VERIFIED | `tools/build-experiments.ts:54-126` (`scanAndValidate`) uses Node `globSync('experiments/*/*/manifest.json', {cwd: root, absolute: true})` for build-time discovery; runtime side uses `import.meta.glob('@experiments/*/*/manifest.json', {eager: true})` in `content-isolated.content.ts:42-45`, `content-main.content.ts:35-37`, and `popup/App.tsx:9-12`. Zod validation at `tools/build-experiments.ts:93` (`ExperimentManifest.safeParse`) emits structured errors that `formatErrors` (line 141) turns into multi-line readable output thrown via `buildExperiments.buildStart` (line 25-32). 13 unit tests in `tools/build-experiments.test.ts` cover discovery, ULID idempotency, Zod errors (bad-world, empty-match, formatErrors shape), author mismatch, and JSON parse failure. |
| 4 | CI lint blocks any commit containing `eval`, `new Function`, or remote `import("https://...")` in plugin or experiment code | ✓ VERIFIED | `scripts/check-csp.ts` exists with three regex patterns at lines 27-31 (`/\beval\s*\(/`, `/\bnew\s+Function\s*\(/`, `/import\s*\(\s*['"]https?:\/\//i`). Wired into both `lefthook.yml:10-11` (`check-csp` pre-commit) and `.github/workflows/ci.yml:43-44` (`Check CSP` step). 12 unit tests in `scripts/check-csp.test.ts` cover positive + negative cases for each regex. `pnpm check-csp` exits 0 on the green tree. Pre-commit demonstration captured verbatim in 01-05-SUMMARY.md "Pre-Commit Demonstration" — a deliberately inserted `eval('1+1')` at `apps/extension/entrypoints/popup/App.tsx:8` was rejected by lefthook (both `check-csp` and Biome's `noGlobalEval` fired) with exit 1, then reverted. |
| 5 | The service worker holds zero in-memory state — restarting the SW (via `chrome://serviceworker-internals` "stop") and triggering an event still produces correct apply/cleanup behavior | ⚠ STRUCTURAL ✓ / EMPIRICAL ? | `apps/extension/src/shared/storage.ts` has zero module-scope mutable state — `grep -E '^(let|var)\s'` returns 0; only two `const` literals (`KEY_ENABLED`, `LAST_ERROR_PREFIX`). All persistence through `chrome.storage.local`. `apps/extension/entrypoints/background.ts` registers the message listener at line 20 (top-level), strictly BEFORE `export default defineBackground` at line 53 — verified by direct file reading. 7 storage unit tests pass. **The literal "stop SW and observe wake-up" behavior requires live Chrome and is deferred to human verification.** |

**Score:** 5/5 truths verified structurally; truths #1 and #5 require Chrome-session empirical confirmation (surfaced as `human_verification` items per project policy).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | Root pnpm workspace, scripts, engines, packageManager | ✓ VERIFIED | `private: true`, `packageManager: pnpm@10.33.2`, `engines.node >=24.0.0`, scripts: dev/build/lint/typecheck/test/check-csp. devDeps include glob ^11.1.0 (added Plan 05). |
| `pnpm-workspace.yaml` | Monorepo workspace declaration | ✓ VERIFIED | Lists `apps/*`, `packages/*`, `tools` (Plan 04 added the `tools` entry). |
| `tsconfig.base.json` / `tsconfig.json` | Shared strict TS + project refs | ✓ VERIFIED | `tsconfig.json` references both `./packages/experiment-sdk` and `./apps/extension`. |
| `biome.json` | Lint + format config | ✓ VERIFIED | `noExplicitAny: error`, `useImportType: error`, ignores `.output/`, `.wxt/`, `node_modules/`, plus `experiments/**/manifest.json` (Plan 04 exclusion to preserve plugin-formatted JSON shape). |
| `lefthook.yml` | Pre-commit gates | ✓ VERIFIED | All four gates wired: lint, typecheck, test, check-csp. |
| `.github/workflows/ci.yml` | CI pipeline | ✓ VERIFIED | Steps: install → lint → typecheck → test --run → check-csp → build. Pinned pnpm 10.33.2 + Node 24. |
| `vitest.config.ts` (root) | Vitest workspace aggregator | ✓ VERIFIED | Vitest 4 `test.projects` aggregator pointing at `apps/*/vitest.config.ts`, `packages/*/vitest.config.ts`, plus root tests. (Plan 01 originally specified `vitest.workspace.ts`; the implementation uses `vitest.config.ts` because Vitest 4 removed `defineWorkspace`. The aggregation behavior is identical and 68 tests aggregate correctly.) |
| `tests/fixtures/manifests/{valid,missing-id,bad-world,empty-match,over-280-description,lowercase-ulid}.json` | Shared fixtures | ✓ VERIFIED | All 6 fixtures present. |
| `tests/sanity.test.ts` | First passing Vitest test | ✓ VERIFIED | Present and passes in the suite. |
| `packages/experiment-sdk/src/index.ts` | ExperimentManifest schema + ApplyArgs/ApplyFn/CleanupFn/Helpers/Tweak types | ✓ VERIFIED | All exports present; ULID regex `^[0-9A-HJKMNP-TV-Z]{26}$`; world enum `['isolated', 'main']` defaulting to 'isolated'; tweaks `array(unknown)` defaulting to []; description max 280. |
| `packages/experiment-sdk/src/manifest.test.ts` | Schema test coverage | ✓ VERIFIED | 14 cases pass (valid + 4 invalid fixtures + 9 in-test mutations of valid). |
| `apps/extension/wxt.config.ts` | Two content scripts, ya.ru matches, @experiments alias, buildExperiments plugin | ✓ VERIFIED | Defines `host_permissions: ['*://ya.ru/*', '*://*.ya.ru/*']`, registers `tailwindcss()` + `buildExperiments({root: repoRoot})`, wires `@experiments` and `@/` aliases. |
| `apps/extension/entrypoints/background.ts` | Top-level listener + defineBackground | ✓ VERIFIED | `chrome.runtime.onMessage.addListener` at line 20, `export default defineBackground` at line 53. SP-7 satisfied. |
| `apps/extension/entrypoints/content-isolated.content.ts` | Engine entry for isolated world | ✓ VERIFIED | Uses `defineContentScript({matches, runAt: 'document_idle'})` (no `world` field — Chrome treats absence as ISOLATED, the documented MV3 default). Bootstrap runs `import.meta.glob` discovery, filters by world, runs reconcile loop with per-call try/catch around apply + cleanup. |
| `apps/extension/entrypoints/content-main.content.ts` | Engine entry for MAIN world (proves ENG-03) | ✓ VERIFIED | `defineContentScript({world: 'MAIN', ...})` at line 21. Built manifest emits the second `content_scripts` block with `"world": "MAIN"`. |
| `apps/extension/src/shared/storage.ts` | Stateless typed chrome.storage.local wrapper | ✓ VERIFIED | Exports `getEnabledExperiments`, `setEnabledExperiment`, `recordLastError`, `clearLastError`. Zero `let`/`var` at module scope. |
| `apps/extension/src/shared/url-match.ts` | Chrome match-pattern matcher | ✓ VERIFIED | Exports `matchesUrl`. Supports apex+subdomain (R6 — `*://*.ya.ru/*` excludes apex; `*://ya.ru/*` matches apex). 10 url-match tests pass. |
| `apps/extension/src/content/engine.ts` | Apply/cleanup orchestration with per-call error isolation | ✓ VERIFIED | Exports `filterByWorld`, `runEngine`. Loop body wraps each apply in own try/catch, records `last_error:<id>` to chrome.storage.local on failure, continues. 5 error-isolation tests pass. |
| `apps/extension/src/test-setup/chrome-mock.ts` | vi.stubGlobal chrome.* mock | ✓ VERIFIED | `makeChromeMock` factory + `beforeEach(() => vi.stubGlobal('chrome', makeChromeMock()))`. Storage areas, runtime.onMessage, tabs.{query,sendMessage}, runtime.lastError, sendMessage all mocked. |
| `apps/extension/entrypoints/popup/App.tsx` | Bare popup with checkbox + EXPERIMENT_TOGGLE dispatch | ✓ VERIFIED | `<input type="checkbox">` per discovered manifest; `onChange` sends `chrome.runtime.sendMessage({type: 'EXPERIMENT_TOGGLE', id, enabled})`. |
| `tools/build-experiments.ts` | Vite plugin for experiment discovery + Zod validation + ULID generation | ✓ VERIFIED | Exports `buildExperiments`, `scanAndValidate`, `authorFromPath`, `formatErrors`, `findRepoRoot`. Plugin name `platform:build-experiments`. ULID write-back idempotent. Author-vs-folder check enforces D-18. |
| `tools/build-experiments.test.ts` | Plugin behavior coverage | ✓ VERIFIED | 13 cases pass: authorFromPath (3), discovery (2), ULID write-back + idempotency (2), Zod errors (3), author mismatch (2), JSON parse (1). |
| `experiments/andrew/smoke/manifest.json` | Smoke manifest (D-28) | ✓ VERIFIED | Stamped ULID `01KQ2WMYX5Z2TZS1GEE6598ERF` matches `^[0-9A-HJKMNP-TV-Z]{26}$`. `name: "Smoke pink"`, `author: "andrew"`, scope matches ya.ru apex+subdomain, `world: "isolated"`, `tweaks: []`. |
| `experiments/andrew/smoke/experiment.ts` | Smoke ApplyFn that pinks ya.ru | ✓ VERIFIED | Imports `ApplyFn` from `@platform/experiment-sdk`, exports `apply` that creates `<style data-exp-id="smoke">body { background: pink !important; }</style>`, returns cleanup that calls `style.remove()`. |
| `scripts/check-csp.ts` | MV3 CSP regex linter | ✓ VERIFIED | Three regex patterns + INCLUDE/IGNORE arrays + glob walk + line-by-line scan. Exits 0/1 with file:line diagnostics. |
| `scripts/check-csp.test.ts` | CSP regex coverage | ✓ VERIFIED | 12 cases pass via `execFileSync(tsx, [scriptPath])` against tmp dirs. |
| `docs/spike/MV3-FOUNDATION.md` | 5-section spike report | ✓ VERIFIED | All 5 sections + smoke checklist + open-questions + sign-off; 163 lines; no placeholder strings; 10 `[x]` smoke boxes. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `lefthook.yml` | `package.json` scripts | `pnpm lint` / `typecheck` / `test --run` / `check-csp` | ✓ WIRED | All four script names match; lefthook runs them in parallel. |
| `.github/workflows/ci.yml` | `package.json` scripts | Same script names + `pnpm build` | ✓ WIRED | All steps present; runs after `pnpm install --frozen-lockfile`. |
| `apps/extension/entrypoints/background.ts` | `apps/extension/src/shared/storage.ts` | `import { setEnabledExperiment } from '@/shared/storage'` | ✓ WIRED | Line 16. Used in `handleToggle` at line 37. |
| `apps/extension/entrypoints/content-isolated.content.ts` | `apps/extension/src/content/engine.ts` | `import { filterByWorld } from '@/content/engine'` | ✓ WIRED | Line 12. Used at line 64 to filter manifests by world. |
| `apps/extension/entrypoints/popup/App.tsx` | `chrome.runtime.sendMessage` | `EXPERIMENT_TOGGLE` message | ✓ WIRED | Line 31: `chrome.runtime.sendMessage({type: 'EXPERIMENT_TOGGLE', id, enabled: next})`. SW handler at `background.ts:23` receives it. |
| `apps/extension/wxt.config.ts` | `experiments/` folder at repo root | Vite alias `@experiments` | ✓ WIRED | Line 32: `@experiments: resolve(repoRoot, 'experiments')` where `repoRoot` is derived from `import.meta.url`. |
| `packages/experiment-sdk/src/manifest.test.ts` | `tests/fixtures/manifests/*.json` | `fs.readFileSync` + `JSON.parse` | ✓ WIRED | Test loads via `resolve(__dirname, '../../../tests/fixtures/manifests')`. |
| `tsconfig.json` | `packages/experiment-sdk/tsconfig.json` + `apps/extension/tsconfig.json` | Project references | ✓ WIRED | Both refs present. |
| `packages/experiment-sdk/package.json` | `zod` | Dependency | ✓ WIRED | `dependencies: { "zod": "^4.3.6" }`. |
| `apps/extension/wxt.config.ts` | `tools/build-experiments.ts` | `vite.plugins: [tailwindcss(), buildExperiments({root: repoRoot})]` | ✓ WIRED | Line 25. |
| `tools/build-experiments.ts` | `@platform/experiment-sdk` | `import { ExperimentManifest } from '@platform/experiment-sdk'` | ✓ WIRED | Line 11. Used in `safeParse` at line 93. |
| `experiments/andrew/smoke/experiment.ts` | `@platform/experiment-sdk` | `import type { ApplyFn } from '@platform/experiment-sdk'` | ✓ WIRED | Line 1. Used as the type of the exported `apply` const. |
| `lefthook.yml` | `scripts/check-csp.ts` | `pnpm check-csp` → `tsx scripts/check-csp.ts` | ✓ WIRED | lefthook command + root package.json script + script file all present and consistent. |
| `.github/workflows/ci.yml` | `scripts/check-csp.ts` | `pnpm check-csp` step | ✓ WIRED | Line 44. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `popup/App.tsx` | `rows` (rendered manifests) | `loadManifests()` via `import.meta.glob('@experiments/*/*/manifest.json', {eager: true})` | Yes — resolves to the smoke manifest at build time; the smoke is a real ULID-stamped manifest in `experiments/andrew/smoke/`. | ✓ FLOWING |
| `popup/App.tsx` | `enabled` (toggle state) | `getEnabledExperiments()` from `@/shared/storage` | Yes — `chrome.storage.local.get('enabled')` returns the user's persisted toggle map. | ✓ FLOWING |
| `content-isolated.content.ts` | `manifestModules` | `import.meta.glob('@experiments/*/*/manifest.json', {eager: true})` | Yes — built bundle contains the smoke (verified by `grep` of `content-isolated.js`). | ✓ FLOWING |
| `content-isolated.content.ts` | `experimentLoaders` | `import.meta.glob('@experiments/*/*/experiment.ts')` (lazy) | Yes — Vite bundles the smoke `apply` into the content script (the literal `background: pink` is present). | ✓ FLOWING |
| `background.ts` `handleToggle` | `tabs` (broadcast targets) | `chrome.tabs.query({})` | Yes — at runtime queries the live Chrome tab list. | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| `pnpm test --run` exits 0 with all suites passing | `pnpm test --run` | "Test Files 8 passed (8) / Tests 68 passed (68)" | ✓ PASS |
| `pnpm typecheck` exits 0 across all project refs | `pnpm typecheck` | exit 0; "tsc -b --pretty" no output (clean) | ✓ PASS |
| `pnpm lint` exits 0 (Biome 37 files) | `pnpm lint` | "Checked 37 files in 51ms. No fixes applied." | ✓ PASS |
| `pnpm check-csp` exits 0 on green tree | `pnpm check-csp` | exit 0 (no violations across `apps/**` + `experiments/**`) | ✓ PASS |
| Built manifest has 2 content_scripts entries with worlds [ISOLATED, MAIN] | `node -e "..."` against `apps/extension/.output/chrome-mv3/manifest.json` | "content_scripts: 2 / worlds: [ 'ISOLATED', 'MAIN' ]" | ✓ PASS |
| Smoke `background: pink` literal present in built `content-isolated.js` | `grep -c 'background: pink' apps/extension/.output/chrome-mv3/content-scripts/content-isolated.js` | 1 | ✓ PASS |
| Stamped ULID matches Crockford regex | `node -e "/^[0-9A-HJKMNP-TV-Z]{26}$/.test(m.id)"` | true / "01KQ2WMYX5Z2TZS1GEE6598ERF" | ✓ PASS |
| SW `addListener` line < `defineBackground` line | Read `background.ts` lines 20 + 53 | 20 < 53 | ✓ PASS |
| Storage module has zero module-scope mutable state | `grep -cE '^(let\|var)\s' apps/extension/src/shared/storage.ts` | 0 | ✓ PASS |
| Background module has zero module-scope mutable state | `grep -cE '^(let\|var)\s' apps/extension/entrypoints/background.ts` | 0 | ✓ PASS |
| Spike doc has no placeholder strings | `grep -cE '(TBD\|TODO\|<EXEC:)' docs/spike/MV3-FOUNDATION.md` | 0 | ✓ PASS |
| Spike doc has 10 [x] checkboxes (D-27 smoke) | `grep -cE '^- \[x\]' docs/spike/MV3-FOUNDATION.md` | 10 | ✓ PASS |
| Live ya.ru smoke (load unpacked → toggle ON → pink → toggle OFF → revert) | Manual Chrome session | n/a — auto-approved per chained-run rule | ? SKIP (requires live Chrome — surfaced as human_verification) |
| SW restart smoke (chrome://serviceworker-internals Stop → re-toggle → still works) | Manual Chrome session | n/a — auto-approved per chained-run rule | ? SKIP (requires live Chrome — surfaced as human_verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ENG-01 | 01-03, 01-04, 01-05 | Расширение собирается под Chromium MV3 и устанавливается через "load unpacked" | ⚠ STRUCTURALLY SATISFIED / EMPIRICAL ? | `apps/extension/.output/chrome-mv3/manifest.json` exists and is MV3-valid; smoke is bundled into `content-isolated.js`; manifest declares ya.ru host_permissions. The literal "Chrome opens, toggles ON → pink" requires Andrew's local browser session (surfaced as human_verification). |
| ENG-02 | 01-03 | Service worker не хранит in-memory состояние — выживает SW termination | ⚠ STRUCTURALLY SATISFIED / EMPIRICAL ? | Top-level addListener at line 20 < defineBackground at line 53; `storage.ts` zero module-scope mutable state (grep `^let` = 0); 7 storage tests pass. The literal "Stop SW, toggle, observe" requires live Chrome (surfaced as human_verification). |
| ENG-03 | 01-03 | Engine routing экспериментов между isolated-world и MAIN-world | ✓ SATISFIED | Built manifest emits TWO `content_scripts` entries; second has `"world": "MAIN"`. `filterByWorld` unit-tested (6 cases). `defineContentScript({world: 'MAIN'})` direct WXT 0.20.x option (R1/A1 resolved). |
| ENG-05 | 01-03 | Engine оборачивает каждый apply()/cleanup() в try/catch | ✓ SATISFIED | `engine.ts` runEngine loop body has per-call try/catch (lines 56-77); content script reconcile loops (`content-isolated.content.ts` + `content-main.content.ts`) wrap each cleanup AND each apply in own try/catch and record `last_error:<id>` on failure. 5 error-isolation tests prove a throwing apply() doesn't prevent siblings. |
| BLD-01 | 01-04 | Discovery via import.meta.glob | ✓ SATISFIED | Build-time: `tools/build-experiments.ts:56` (`globSync('experiments/*/*/manifest.json')`). Runtime: `import.meta.glob('@experiments/*/*/manifest.json', {eager: true})` in content-isolated, content-main, popup/App. Both verified. |
| BLD-02 | 01-04 | Zod-валидация манифеста при сборке, понятный error | ✓ SATISFIED | `scanAndValidate` runs `ExperimentManifest.safeParse` per manifest and returns structured errors; `formatErrors` produces multi-line readable output; `buildExperiments.buildStart` throws on any error so Vite turns it into a build failure. 3 Zod-error tests including a `formatErrors` shape assertion. |
| BLD-05 | 01-05 | CI lint падает при использовании eval / new Function / remote import | ✓ SATISFIED | `scripts/check-csp.ts` with three regex patterns; wired into both lefthook pre-commit AND `.github/workflows/ci.yml`; demonstrated to block a deliberate `eval('1+1')` commit (captured in 01-05-SUMMARY "Pre-Commit Demonstration" — both check-csp AND Biome's noGlobalEval fired). 12 unit tests cover positive + negative for each regex. |
| MAN-01 | 01-02 | Манифест эксперимента — manifest.json с полями id/name/author/description/scope/world/tweaks | ✓ SATISFIED | Schema in `packages/experiment-sdk/src/index.ts` enforces all 7 fields with the documented constraints (ULID regex, min/max strings, scope.match min(1), world enum default 'isolated', tweaks default []). 14 schema tests pass. |

All 8 phase requirement IDs are accounted for. None orphaned. None additional in REQUIREMENTS.md mapped to Phase 1 beyond these 8 (verified via `grep` against the traceability table — 8 listed for Phase 1, all 8 covered by plans).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/extension/src/content/engine.ts` | 73-74 | `await recordLastError(...).catch(() => { /* recording failure must also not break the loop */ })` | ℹ Info | Intentional swallow with explanation; documented as per SP-2. Not a stub — it's defensive error handling for the error path itself. |
| `apps/extension/entrypoints/content-isolated.content.ts` | 100, 131 | `await recordLastError(...).catch(() => {})` | ℹ Info | Same defensive pattern. Acceptable. |
| `apps/extension/entrypoints/content-isolated.content.ts` | 47 | Comment "BLD-04 deferred to Phase 2 fully" | ℹ Info | Phase boundary acknowledgment, not a stub. Vite produces per-experiment chunks for non-eager `import.meta.glob` automatically. |
| `apps/extension/entrypoints/content-main.content.ts` | 53-54 | Bootstrap path returns early when `myLoaders.length === 0` | ℹ Info | Phase 1 has no MAIN-world experiments; the file exists structurally to prove ENG-03 routing emits two manifest blocks. The reconcile path is correct and will activate when a Phase 2+ MAIN experiment lands. |
| `apps/extension/src/content/engine.ts` | 35-43 | Doc comment "Phase 2 will add a cleanup registry" | ℹ Info | Plan 01-03 deliberately split `runEngine` (pure-testable) from the content-script reconcile loop (which DOES retain cleanups). The cleanup retention IS implemented — it lives in `content-isolated.content.ts:38` and `content-main.content.ts:32` via the `cleanups: Map<string, CleanupFn>` per content-script context. ENG-05 (error isolation) is the Phase 1 focus and is verified. |

No `🛑 Blocker` or `⚠ Warning` anti-patterns found. All identified items are documented Phase-1 boundaries or defensive error-path patterns, not stubs.

### Human Verification Required

#### 1. Live extension load + ya.ru smoke (Roadmap Success Criterion #1)

**Test:**
1. From repo root: `pnpm -F @platform/extension build` (already green; re-run if tree has changed).
2. Open Chrome stable. Visit `chrome://extensions`. Toggle "Developer mode" ON.
3. Click "Load unpacked" → select `apps/extension/.output/chrome-mv3/`. Confirm extension card "Designer Experiment Platform" appears with NO error.
4. Open new tab to `https://ya.ru/`. Page renders normally (NOT pink).
5. Click extension icon → popup opens with "Smoke pink by andrew" + an unchecked checkbox.
6. Toggle checkbox ON → page background turns pink within ~1-2 seconds.
7. Toggle OFF → page background reverts cleanly (no leftover `<style data-exp-id="smoke">`).
8. Open the page DevTools console while smoke is ON. No red errors prefixed `[engine]` or `[exp]`.

**Expected:** Steps 4-7 produce the empirical apply/cleanup cycle. Step 8 confirms no runtime errors.

**Why human:** Roadmap Success Criterion #1 is an empirical claim about live Chrome. The Plan 05 SW-restart smoke checklist boxes were marked `[x]` under the chained-run `--auto` rule (explicitly disclosed in 01-05-SUMMARY.md "Human-Verify Outcome" and in the spike doc itself). Andrew's local Chrome session is the durable verification record.

#### 2. Service worker restart smoke (Roadmap Success Criterion #5)

**Test:**
1. With extension loaded and ya.ru open, toggle smoke ON (page pink), then OFF (revert) — pre-restart sanity.
2. Open `chrome://serviceworker-internals` → find the extension's SW → click "Stop". The SW row should change to STOPPED.
3. Re-open the popup. Toggle smoke ON again.
4. Page background turns pink again.
5. Toggle OFF → reverts cleanly.

**Expected:** Step 4 proves the SW woke from a cold start, the top-level `chrome.runtime.onMessage.addListener` fired before `defineBackground` main(), `chrome.storage.local` was read fresh (no in-memory cache), and `STATE_CHANGED` was broadcast to the ya.ru tab where the content-script reconcile loop applied the smoke.

**Why human:** Roadmap Success Criterion #5 is a runtime-only behavior (SW lifecycle interaction) that the unit tests cannot reach. Structural prerequisites (zero module-scope mutable state, top-level listener ordering) are independently verified, but the empirical "Stop and re-trigger" is Andrew's gate.

### Gaps Summary

No structural gaps blocking the goal. The phase is functionally complete — the extension builds, the smoke is bundled, the popup wires to the SW, the SW handles the toggle, the content scripts reconcile, the build pipeline validates manifests with Zod and stamps ULIDs, the CSP guardrail blocks forbidden patterns, and the spike report addresses all five mandated MV3 risk topics. Two Roadmap Success Criteria (#1 and #5) are empirical claims about live Chrome behavior that require Andrew's local browser session for the durable verification record. These are surfaced as `human_verification` items, not as gaps, because (a) every structural prerequisite is verified, (b) the chained-run auto-approval was explicitly disclosed in the spike doc and 01-05-SUMMARY.md, and (c) the project's `01-VALIDATION.md` "Manual-Only Verifications" table classifies these exact behaviors as manual-only carve-outs deferred to a real Chrome session.

---

_Verified: 2026-04-25T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
