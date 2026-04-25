---
phase: 01-foundation-spike-engine-skeleton
plan: 03
subsystem: extension
tags: [wxt, mv3, react19, tailwindcss-v4, vitest, chrome-mock, content-scripts, service-worker, two-world-routing]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm workspace, Vitest 4 framework, Biome 2.4 lint, root tsconfig.base.json, lefthook pre-commit (lint+typecheck+test, check-csp commented), tests/fixtures/manifests/*.json
  - phase: 01-02
    provides: "@platform/experiment-sdk (workspace package) — ApplyFn / ApplyArgs / CleanupFn / Helpers / Tweak types + ExperimentManifest Zod schema (D-15 + D-16)"
provides:
  - "@platform/extension WXT 0.20.25 React-TS app workspace package — buildable, type-clean, lint-clean MV3 skeleton"
  - "Loadable Chromium MV3 extension at apps/extension/.output/chrome-mv3/ — TWO content_scripts blocks (ISOLATED + MAIN) verified in built manifest"
  - "Stateless service worker (entrypoints/background.ts) — chrome.runtime.onMessage.addListener at module top-level (line 20 < defineBackground at line 53)"
  - "Two content-script entrypoints — content-isolated.content.ts (default ISOLATED) and content-main.content.ts (world: 'MAIN'); proves ENG-03 declarative routing structurally"
  - "Engine pure modules — src/content/engine.ts (filterByWorld + runEngine with per-call try/catch around apply) + src/shared/{messages,storage,url-match}.ts"
  - "28 Vitest cases across 4 test files — storage(7), url-match(10), world-routing(6), error-isolation(5); all green"
  - "src/test-setup/chrome-mock.ts — vi.stubGlobal('chrome', ...) with storage.local + storage.session + runtime.onMessage + tabs APIs; importable as workspace setupFile"
  - "Bare popup (D-29) — discovers manifests via import.meta.glob, renders <input type=checkbox> per row, dispatches EXPERIMENT_TOGGLE messages"
  - "@experiments Vite alias resolved to repo-root experiments/ (RESEARCH R3 — alias path, not symlink, not srcDir games)"
  - "@/ Vite alias to apps/extension/src/ (duplicated from tsconfig paths because WXT/Vite does NOT auto-honor tsconfig paths)"
  - "Root vitest.config.ts (Vitest 4 test.projects field) — replaces legacy vitest.workspace.ts which used the removed defineWorkspace API"
  - "host_permissions for ya.ru apex + subdomains; permissions: storage + tabs; manifest_version 3"
affects: [Plan 01-04 (build plugin consumes manifest schema and emits chunks for the existing engine), Plan 01-05 (CSP guardrail will scan apps/extension/ + experiments/), Phase 2 (popup polish — UI-08 last_error rendering, Zustand state, shadcn cards), Phase 3 (TWK-01 tweak union replaces tweaks: z.array(z.unknown())), Phase 4 (helpers extension HLP-01..HLP-09)]

# Tech tracking
tech-stack:
  added:
    - "wxt@0.20.25 (MV3 framework wrapping Vite 8.0.10) — file-based entrypoints, manifest gen, content-script HMR"
    - "@wxt-dev/module-react@1.1.5 (React integration auto-included by wxt init -t react)"
    - "react@19.2.5 + react-dom@19.2.5 (popup UI)"
    - "tailwindcss@4.2.4 + @tailwindcss/vite@4.2.4 (Tailwind v4 single-import @import 'tailwindcss';)"
    - "@types/chrome@0.1.40 (Chrome MV3 API types)"
    - "zod@4.3.6 (transitive; consumed by extension via @platform/experiment-sdk)"
    - "vite@8.0.10 (transitive via WXT — confirmed Vite 8.x not 6.x as STACK.md guessed)"
    - "esbuild@0.27.7, spawn-sync@1.0.15 (transitive build deps)"
  patterns:
    - "SP-1 (stateless SW): zero module-scope let/const state in background.ts; all persistence via src/shared/storage.ts; verified by grep '^let\\s' returning 0"
    - "SP-2 (per-call error isolation): every apply() and every cleanup() wrapped in its OWN try/catch; failing experiment doesn't break siblings; proven by error-isolation.test.ts"
    - "SP-3 (static discovery via import.meta.glob): no runtime fetch; @experiments alias resolves to repo-root experiments/; eager:true for manifests, lazy chunks for experiment.ts"
    - "SP-4 (Zod manifest as single source of truth): SDK schema imported by both content-isolated and content-main entries; Phase 4 build plugin will use the same schema at build time"
    - "SP-5 (Chrome match-pattern apex+subdomain duplicate): host_permissions and content_script.matches both list ['*://ya.ru/*', '*://*.ya.ru/*']"
    - "SP-7 (top-level listener registration): chrome.runtime.onMessage.addListener at module top — line-number assertion in tests confirms it precedes defineBackground"
    - "Vite alias duplication for tsconfig paths: WXT/Vite does NOT auto-honor tsconfig.json paths field; '@/' alias must be redeclared in wxt.config.ts vite.resolve.alias"

key-files:
  created:
    - "apps/extension/package.json — @platform/extension workspace package; deps: react/react-dom/zod/@platform/experiment-sdk; devDeps: wxt + tailwindcss + @types/chrome + vitest"
    - "apps/extension/tsconfig.json — composite project ref extending tsconfig.base.json; includes src/, entrypoints/, .wxt/wxt.d.ts, .wxt/types/; allowImportingTsExtensions: true (WXT scaffold convention)"
    - "apps/extension/wxt.config.ts — manifest with ya.ru host_permissions, @tailwindcss/vite plugin, '@/' + '@experiments' Vite aliases"
    - "apps/extension/vitest.config.ts — node env, @ alias, chrome-mock setupFile"
    - "apps/extension/entrypoints/background.ts — top-level chrome.runtime.onMessage.addListener (line 20) BEFORE defineBackground (line 53); EXPERIMENT_TOGGLE handler writes storage + broadcasts STATE_CHANGED to all tabs (per-tab errors suppressed)"
    - "apps/extension/entrypoints/content-isolated.content.ts — defineContentScript without explicit world (defaults ISOLATED in WXT 0.20.x); reconcile loop with per-call try/catch around apply() and cleanup()"
    - "apps/extension/entrypoints/content-main.content.ts — defineContentScript({world: 'MAIN'}); same reconcile shape; Phase 1 myLoaders is empty so reconcile early-returns"
    - "apps/extension/entrypoints/popup/App.tsx — bare-bones list, <input type=checkbox> per discovered manifest, sendMessage(EXPERIMENT_TOGGLE) on change (D-29)"
    - "apps/extension/entrypoints/popup/main.tsx — React 19 createRoot mount; imports @/styles/popup.css"
    - "apps/extension/src/shared/messages.ts — ExtensionMessage union (EXPERIMENT_TOGGLE, STATE_CHANGED) + isExtensionMessage type guard"
    - "apps/extension/src/shared/storage.ts — getEnabledExperiments / setEnabledExperiment / recordLastError / clearLastError; ZERO module-scope mutable state (only KEY_ENABLED/LAST_ERROR_PREFIX const literals)"
    - "apps/extension/src/shared/url-match.ts — Chrome match-pattern matcher; subdomain wildcard EXCLUDES apex (R6); supports scheme '*'/'http'/'https', host literal/'*'/'*.suffix', path glob"
    - "apps/extension/src/content/engine.ts — filterByWorld + runEngine; for-loop with try/catch wrapping each apply() body individually (NOT a single try around the whole loop)"
    - "apps/extension/src/test-setup/chrome-mock.ts — vi.stubGlobal('chrome', makeChromeMock()); explicit ChromeMock + StorageAreaMock return types (composite TS requirement)"
    - "apps/extension/src/styles/popup.css — Tailwind v4 @import 'tailwindcss'; + minimal base (margin/padding/min-width/font-family)"
    - "apps/extension/src/shared/storage.test.ts (7 cases), url-match.test.ts (10), world-routing.test.ts (6), error-isolation.test.ts (5) — all green"
    - "vitest.config.ts (root) — Vitest 4 test.projects field aggregating apps/*/vitest.config.ts + packages/*/vitest.config.ts + root tests/scripts/tools globs"
  modified:
    - "tsconfig.json — added second project reference { path: './apps/extension' } (Plan 01-02 added the SDK ref)"
    - "pnpm-lock.yaml — 335 packages added (WXT, React 19, Tailwind 4, Vitest 4 transitive vite/esbuild)"
  deleted:
    - "vitest.workspace.ts — Vitest 4 dropped defineWorkspace; replaced with root vitest.config.ts using test.projects"
    - "apps/extension/entrypoints/content.ts — WXT scaffold default; replaced by content-isolated.content.ts + content-main.content.ts"
    - "apps/extension/entrypoints/popup/App.css, popup/style.css — WXT scaffold styling; replaced by src/styles/popup.css (Tailwind v4)"
    - "apps/extension/assets/react.svg — WXT scaffold logo; popup no longer references it"

key-decisions:
  - "Resolved R1/A1: WXT 0.20.25 supports defineContentScript({ world: 'MAIN' }) directly via its IsolatedWorldContentScriptDefinition + MainWorldContentScriptDefinition union (types.d.mts:703-718). NO manifest hook fallback needed."
  - "Resolved R7/A3: WXT does NOT wrap top-level statements into defineBackground's main(). Module-scope chrome.runtime.onMessage.addListener IS preserved at module top of the built SW. Verified in apps/extension/.output/chrome-mv3/background.js: addListener call is in the IIFE body BEFORE the o.main() invocation that runs defineBackground."
  - "Resolved R3/A4: Vite alias @experiments resolves cleanly to repo-root experiments/. import.meta.glob accepts the alias-prefixed path. No symlink (Windows-hostile) or srcDir override needed."
  - "Vitest 4 migration: removed legacy vitest.workspace.ts (defineWorkspace was deleted in v4) and replaced with a root vitest.config.ts using the new test.projects field. Per-package configs now actually load (alias + setupFile resolution works)."
  - "WXT init template flag is -t react (NOT --template react-ts). WXT 0.20.25 templates are vanilla/vue/react/solid/svelte; TS is built into all of them."
  - "WXT scaffold's auto-imports of defineBackground/defineContentScript work via .wxt/types/imports.d.ts. We chose explicit imports from wxt/utils/define-background and wxt/utils/define-content-script for clarity (the plan said 'wxt/sandbox' which doesn't exist in 0.20.25)."
  - "WXT/Vite does NOT auto-resolve tsconfig.json paths. The '@/' alias must be redeclared in wxt.config.ts vite.resolve.alias for runtime resolution to work — TypeScript paths are typecheck-only."
  - "Composite TypeScript projects require explicit return-type annotations on exported functions whose inferred type uses internal modules. makeChromeMock and makeStorageArea both got explicit type annotations for this reason (TS2883)."
  - "WXT-managed types live in .wxt/wxt.d.ts (top-level) referencing wxt/vite-builder-env. Our tsconfig.json includes .wxt/wxt.d.ts + .wxt/types/**/* explicitly so tsc -b sees both. The plan's 'vite/client' types entry was wrong — vite is a transitive dep, not a direct one."

patterns-established:
  - "Per-call error isolation in content-script reconcile loops — every apply() and every cleanup() wrapped in its OWN try/catch (not a single outer try); errors logged to console + chrome.storage.local under 'last_error:<id>'. Phase 2 will add UI rendering of last_errors (UI-08) but the storage write contract is locked here."
  - "Stateless service-worker contract — top-level listener registration BEFORE defineBackground; ALL state through src/shared/storage.ts (chrome.storage.local). The SW IIFE runs from scratch on every wake, so the listener re-registers and storage is the only persistence."
  - "Two-world content script convention — entrypoints/<name>.content.ts files auto-discovered by WXT; defineContentScript({world: 'MAIN'}) for MAIN-world experiments, defineContentScript({matches}) for ISOLATED (default). Built manifest emits TWO content_scripts blocks structurally."
  - "Vite alias duplication pattern — '@experiments' (cross-package, repo-root) and '@/' (intra-package, src/) BOTH declared in wxt.config.ts vite.resolve.alias because WXT does not honor tsconfig paths at runtime. tsconfig paths is typecheck-only."
  - "Vitest 4 workspace config — root vitest.config.ts with test.projects aggregating per-package vitest.config.ts files. Each package config can set its own setupFiles (e.g., chrome-mock.ts) and resolve.alias; root config's projects[] is the entry point."

requirements-completed: [ENG-01, ENG-02, ENG-03, ENG-05]

# Metrics
duration: 20min42s
completed: 2026-04-25
---

# Phase 1 Plan 03: WXT Scaffold + Engine Skeleton Summary

**Loadable Chromium MV3 extension skeleton — WXT 0.20.25 React-TS app with stateless top-level-listener SW, two declarative content scripts (ISOLATED + MAIN), per-call error-isolated engine, typed storage/messages/url-match, Tailwind v4 Vite plugin, and 28 Vitest cases proving every engine pure-function unit (ENG-01/02/03/05 closed).**

## Performance

- **Duration:** 20min42s
- **Started:** 2026-04-25T17:23:22Z
- **Completed:** 2026-04-25T17:44:04Z
- **Tasks:** 3
- **Files created:** 18
- **Files modified:** 2 (tsconfig.json, pnpm-lock.yaml)
- **Files deleted:** 5 (1 root + 4 WXT scaffold defaults)

## Accomplishments

- `pnpm -F @platform/extension build` produces `apps/extension/.output/chrome-mv3/manifest.json` with **2** `content_scripts` entries: `[{world: ISOLATED}, {world: MAIN}]` — ENG-03 PROVEN structurally
- `chrome.runtime.onMessage.addListener(...)` lives at module top-level (line 20 of `entrypoints/background.ts`) BEFORE `export default defineBackground(...)` (line 53). Verified in built `background.js`: the call is in the IIFE body before `o.main()` runs — ENG-02 architecturally complete
- Engine error isolation proven by `error-isolation.test.ts`: a throwing `apply()` for experiment A is caught, `last_error:A` recorded, and `apply()` for experiment B still runs and is recorded as `applied` — ENG-05 closed
- 4 engine pure-function units green: `storage.test.ts (7)` + `url-match.test.ts (10)` + `world-routing.test.ts (6)` + `error-isolation.test.ts (5)` = 28 tests, plus 14 SDK + 1 sanity = **43 tests total, all pass**
- `pnpm typecheck`, `pnpm lint`, `pnpm install --frozen-lockfile`, `pnpm -F @platform/extension build` all exit 0 from repo root
- Bare popup (D-29) renders empty list with helpful message until Plan 04 ships an experiment
- Resolved 4 of the 5 spike unknowns (R1, R3, R7, A1/A3/A4) by direct verification against installed WXT 0.20.25 source — Plan 05 spike doc will record findings; the empirical content-script HMR + dynamic-import cache-busting + SW idle-termination measurements remain for Plan 05's manual smoke

## Task Commits

Each task was committed atomically:

1. **Task 1: WXT scaffold + Tailwind + dependencies + Vitest config + chrome mock** — `2796da4` (chore)
2. **Task 2: Engine pure modules — messages, storage, url-match, engine — with full Vitest coverage** — `9369762` (feat)
3. **Task 3: Entrypoints — background SW, content scripts (isolated + main), popup** — `b940117` (feat)

Plan-level final commit: pending (after this SUMMARY.md + STATE.md/ROADMAP.md updates).

## Verified-Running Commands

| Command | Status | Notes |
|---------|--------|-------|
| `pnpm install --frozen-lockfile` | OK | Lockfile up-to-date; 335 packages added vs Plan 01-02 baseline |
| `pnpm typecheck` | OK | tsc -b --pretty resolves all 3 project refs (root → SDK + extension) |
| `pnpm lint` | OK | Biome checks 31 files, 0 errors, 0 warnings |
| `pnpm test --run` | OK | 6 test files / 43 tests / ~250ms |
| `pnpm vitest run apps/extension/src/shared/storage.test.ts apps/extension/src/shared/url-match.test.ts apps/extension/src/content/world-routing.test.ts apps/extension/src/content/error-isolation.test.ts` | OK | 4 files / 28 tests (Plan 03 must-haves) |
| `pnpm -F @platform/extension build` | OK | Produces .output/chrome-mv3/{manifest.json, background.js, content-scripts/{content-isolated,content-main}.js, popup.html, ...} — total 388.59 kB |

## Built Manifest Inspection (resolves R1/A1)

`cat apps/extension/.output/chrome-mv3/manifest.json | python3 -m json.tool` →

```json
{
  "manifest_version": 3,
  "name": "Designer Experiment Platform",
  "description": "Phase 1 foundation skeleton",
  "version": "0.0.0",
  "permissions": ["storage", "tabs"],
  "host_permissions": ["*://ya.ru/*", "*://*.ya.ru/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_title": "Default Popup Title", "default_popup": "popup.html" },
  "content_scripts": [
    {
      "matches": ["*://*.ya.ru/*", "*://ya.ru/*"],
      "run_at": "document_idle",
      "js": ["content-scripts/content-isolated.js"]
    },
    {
      "matches": ["*://*.ya.ru/*", "*://ya.ru/*"],
      "run_at": "document_idle",
      "js": ["content-scripts/content-main.js"],
      "world": "MAIN"
    }
  ]
}
```

- **TWO `content_scripts` blocks** — first omits `world` (Chrome treats absence as ISOLATED), second declares `"world": "MAIN"`.
- `defineContentScript({ world: 'MAIN' })` worked **directly** in WXT 0.20.25. The fallback `wxt.config.ts` `manifest` hook was NOT needed — the plan's R1 fallback path was speculative; reality is simpler.
- Both content scripts share the same `matches` and `run_at`, so WXT (rightly) emits separate blocks because the `world` field differs.

## Background SW Listener Order (resolves R7/A3)

`grep -n 'chrome\.runtime\.onMessage\.addListener\|export default defineBackground' apps/extension/entrypoints/background.ts` →

```
5: *   chrome.runtime.onMessage.addListener MUST run at module top-level so the   ← docblock comment
20:chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {        ← actual top-level call
53:export default defineBackground(() => {                                        ← WXT main wrapper
```

Line 20 (actual `addListener`) < Line 53 (`defineBackground`). The plan's strict awk pipeline test passes.

Inspecting the **built** SW (`apps/extension/.output/chrome-mv3/background.js`) confirms the listener is at IIFE top-level:

```js
var background=(function(){
  function e(e){...}
  function t(e){...}    // isExtensionMessage
  var n="enabled";
  async function r(){...}    // getEnabledExperiments
  async function i(e,t){...} // setEnabledExperiment

  chrome.runtime.onMessage.addListener((e,n,r)=>...)   // ← here, BEFORE main()

  async function a(e,t){...}  // handleToggle
  var o=e(()=>{});            // defineBackground wrapper
  ...
  var p; try { p=o.main(); ... } catch(e) {...}        // ← o.main() runs LAST
  return p
})();
```

So when Chrome cold-starts the SW, the IIFE re-runs from line 1, the listener is re-registered immediately, and only then does `defineBackground.main()` execute. Idle-termination wake-up via the listener works as Pitfall 1 demands.

## Files Created (18)

**Config (5):**
- `apps/extension/package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`
- `vitest.config.ts` (repo root)

**Entrypoints (5):**
- `apps/extension/entrypoints/background.ts`, `content-isolated.content.ts`, `content-main.content.ts`
- `apps/extension/entrypoints/popup/App.tsx`, `main.tsx`
  *(popup/index.html came from WXT scaffold and is preserved)*

**Source modules (5):**
- `apps/extension/src/shared/messages.ts`, `storage.ts`, `url-match.ts`
- `apps/extension/src/content/engine.ts`
- `apps/extension/src/test-setup/chrome-mock.ts`

**Tests (4):**
- `apps/extension/src/shared/storage.test.ts`, `url-match.test.ts`
- `apps/extension/src/content/world-routing.test.ts`, `error-isolation.test.ts`

**Style (1):**
- `apps/extension/src/styles/popup.css`

## Files Modified (2)

- `tsconfig.json` (root) — added `{ "path": "./apps/extension" }` to references (alongside the SDK ref from Plan 01-02)
- `pnpm-lock.yaml` — 335 packages added; new direct deps: `wxt 0.20.25`, `react 19.2.5`, `react-dom 19.2.5`, `tailwindcss 4.2.4`, `@tailwindcss/vite 4.2.4`, `@types/chrome 0.1.40`, `@types/react 19.2.14`, `@types/react-dom 19.2.3`, `@wxt-dev/module-react 1.1.5` (zod 4.3.6 already came via SDK)

## Files Deleted (5)

- `vitest.workspace.ts` (root) — Vitest 4 removed `defineWorkspace`; replaced by root `vitest.config.ts` using `test.projects`
- `apps/extension/entrypoints/content.ts` — WXT scaffold's single-content-script default; superseded by `content-isolated.content.ts` + `content-main.content.ts`
- `apps/extension/entrypoints/popup/App.css`, `popup/style.css` — WXT scaffold default styling; superseded by `src/styles/popup.css` (Tailwind v4 import)
- `apps/extension/assets/react.svg` — WXT scaffold demo logo; popup no longer references it

All 5 deletions are intentional (replacing scaffold defaults with Phase 1 implementations).

## Decisions Made

- **WXT init flag is `-t react` not `--template react-ts`** — Plan called for `--template react-ts` but WXT 0.20.25 only accepts `-t <name>` and the available templates are `vanilla|vue|react|solid|svelte`. TS is built into all WXT templates (the scaffold writes a TS-aware `tsconfig.json` and TS source files regardless).
- **Use explicit imports from `wxt/utils/define-background` + `wxt/utils/define-content-script`** — Plan said `import { defineBackground } from 'wxt/sandbox'` but `wxt/sandbox` does not exist in WXT 0.20.25's exports. WXT also auto-imports both as globals via `.wxt/types/imports.d.ts`, but explicit imports are clearer for code review.
- **`postinstall: wxt prepare` retained from WXT scaffold** — Re-runs WXT's type generator on every install, which keeps `.wxt/wxt.d.ts` and `.wxt/types/*` in sync. Plan Step 11 wanted a single `wxt prepare` after install; the scaffold's `postinstall` does this automatically and on every install.
- **`composite: true` requires explicit return-type annotations** — `makeChromeMock` and `makeStorageArea` both got explicit return types (`ChromeMock` / `StorageAreaMock`) because composite TypeScript projects can't emit declarations whose inferred types reference internal Vitest modules (`Procedure`).
- **Drop `vite/client` from tsconfig `types`** — Plan said `types: ["chrome", "vite/client"]` but vite is a transitive dep (only direct dep in apps/extension is wxt). WXT auto-generates `.wxt/wxt.d.ts` referencing `wxt/vite-builder-env` (their version of vite client types); we include `.wxt/wxt.d.ts` in the tsconfig include and drop `vite/client` from `types`.
- **`allowImportingTsExtensions: true` added to apps/extension/tsconfig.json** — Plan extends `tsconfig.base.json` (no allowImportingTsExtensions). WXT scaffold's `popup/main.tsx` imports `./App.tsx` (with explicit .tsx extension), and the scaffold's original `tsconfig.json` extended `.wxt/tsconfig.json` which sets this flag. Adding it back keeps WXT's bundler-style import compatibility.
- **Add `'@/'` Vite alias to `wxt.config.ts` vite.resolve.alias** — Plan declares `@/*` only in `tsconfig.json` paths. TypeScript honors paths for typechecking, but Vite/WXT does NOT auto-resolve them at runtime. Without the runtime alias, `wxt prepare` and `wxt build` fail with "Cannot find module '@/shared/messages'". Solution: declare both aliases (`@/` and `@experiments`) in `vite.resolve.alias`. Common Vite pitfall — `vite-tsconfig-paths` plugin is the alternative but adds a dep.
- **Migrate root vitest.workspace.ts → vitest.config.ts (Vitest 4)** — Plan 01-01 wrote `vitest.workspace.ts` using `defineWorkspace([...])` from `vitest/config`. That import returns `undefined` in Vitest 4 (the function was removed); the file was effectively a no-op. Tests still ran because Vitest 4 silently fell back to scanning all `*.test.ts` under root, but per-package configs (alias + setupFiles) were ignored. Migration: delete `vitest.workspace.ts`, write a root `vitest.config.ts` with `test.projects: ['./apps/*/vitest.config.ts', './packages/*/vitest.config.ts', { test: { name: 'root', include: ['tests/**/*.test.ts', ...] } }]`. Result: per-package configs now actually load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WXT init flag mismatch**
- **Found during:** Task 1, Step 1 (initial WXT scaffold)
- **Issue:** Plan called `pnpm dlx wxt@0.20.25 init apps/extension --template react-ts --pm pnpm`. WXT 0.20.25 CLI only supports `-t <template>` (short form), and the available templates are `vanilla|vue|react|solid|svelte` — `react-ts` is not a template name. The `--template` long flag also doesn't exist; running it dropped into interactive mode.
- **Fix:** Used `pnpm dlx wxt@0.20.25 init apps/extension -t react --pm pnpm`. TS is built into all WXT templates (`react` produces a TS-aware scaffold).
- **Files modified:** Whole `apps/extension/` scaffold.
- **Verification:** WXT generated all expected files (`entrypoints/{background,content,popup}`, `wxt.config.ts`, `tsconfig.json`, `package.json`, etc.). `pnpm install` succeeded.
- **Committed in:** `2796da4` (Task 1)

**2. [Rule 3 - Blocking] `wxt/sandbox` import path doesn't exist in WXT 0.20.25**
- **Found during:** Task 3 (writing background.ts and content-*.content.ts)
- **Issue:** Plan said `import { defineBackground } from 'wxt/sandbox'` and `import { defineContentScript } from 'wxt/sandbox'`. Inspection of `node_modules/wxt/package.json` showed no `./sandbox` exports subpath. Real exports are `wxt/utils/define-background`, `wxt/utils/define-content-script`, plus the auto-import system (`.wxt/types/imports.d.ts` declares them as globals).
- **Fix:** Use explicit subpath imports: `import { defineBackground } from 'wxt/utils/define-background'` and `import { defineContentScript } from 'wxt/utils/define-content-script'`.
- **Files modified:** `apps/extension/entrypoints/background.ts`, `content-isolated.content.ts`, `content-main.content.ts`.
- **Verification:** typecheck passes; `wxt build` produces working SW + content scripts.
- **Committed in:** `b940117` (Task 3)

**3. [Rule 1 - Bug] `vite/client` types in tsconfig — vite isn't a direct dep**
- **Found during:** Task 1 (first `pnpm typecheck`)
- **Issue:** Plan's tsconfig.json sets `"types": ["chrome", "vite/client"]`. Vite is a transitive dep (bundled inside WXT), and `@types/vite-client` doesn't exist as a separate package; the actual types live at `vite/client.d.ts` inside the vite package. Hoisting via pnpm doesn't put vite in `apps/extension/node_modules/vite`. Result: `error TS2688: Cannot find type definition file for 'vite/client'`.
- **Fix:** Drop `vite/client` from `types`. WXT auto-generates `.wxt/wxt.d.ts` which references `wxt/vite-builder-env` (functionally equivalent to `vite/client`); add `.wxt/wxt.d.ts` to the tsconfig `include`.
- **Files modified:** `apps/extension/tsconfig.json` (`types: ["chrome"]`, `include: [..., '.wxt/wxt.d.ts', ...]`).
- **Verification:** `pnpm typecheck` exits 0; `import.meta.glob` types resolve correctly.
- **Committed in:** `2796da4` (Task 1)

**4. [Rule 1 - Bug] Composite TS project can't emit `makeChromeMock` declaration without explicit return type**
- **Found during:** Task 1 (typecheck of test-setup/chrome-mock.ts under composite=true)
- **Issue:** `error TS2883: The inferred type of 'makeChromeMock' cannot be named without a reference to 'Procedure' from .pnpm/@vitest+spy@4.1.5/node_modules/@vitest/spy. This is likely not portable. A type annotation is necessary.` Composite projects emit `.d.ts` files; the inferred return type referenced an internal Vitest type only resolvable via a deep node_modules path, which TS rejects.
- **Fix:** Added explicit `ChromeMock` and `StorageAreaMock` types to `chrome-mock.ts` and annotated `makeChromeMock(): ChromeMock` and `makeStorageArea(): StorageAreaMock`. Both types use Vitest's public `Mock` type (exported from `vitest`).
- **Files modified:** `apps/extension/src/test-setup/chrome-mock.ts`.
- **Verification:** `pnpm typecheck` exits 0; `pnpm test --run` continues to pass.
- **Committed in:** `2796da4` (Task 1)

**5. [Rule 1 - Bug] `allowImportingTsExtensions` missing — WXT scaffold's popup imports `./App.tsx`**
- **Found during:** Task 1 (typecheck after switching tsconfig to extend tsconfig.base.json)
- **Issue:** WXT scaffold's `popup/main.tsx` does `import App from './App.tsx'` (with explicit .tsx extension). The original WXT-generated `tsconfig.json` extended `.wxt/tsconfig.json` which sets `allowImportingTsExtensions: true`. Our new tsconfig extends `tsconfig.base.json` directly which doesn't set that flag. Result: `error TS5097: An import path can only end with a '.tsx' extension when 'allowImportingTsExtensions' is enabled.`
- **Fix:** Added `"allowImportingTsExtensions": true` to `apps/extension/tsconfig.json` compilerOptions. This is WXT's convention; Task 3 popup main.tsx still uses `import { App } from './App'` (no extension) but the flag is needed for any other WXT-internal imports.
- **Files modified:** `apps/extension/tsconfig.json`.
- **Verification:** `pnpm typecheck` exits 0.
- **Committed in:** `2796da4` (Task 1)

**6. [Rule 1 - Bug] WXT scaffold default popup files trip Biome lint**
- **Found during:** Task 1 (first `pnpm lint`)
- **Issue:** WXT scaffold's `popup/App.tsx` and `popup/main.tsx` used `target="_blank"` without `rel="noopener"` (security), `<button>` without `type` attribute (a11y), and `document.getElementById('root')!` non-null assertion (style). The lefthook pre-commit blocked the commit until lint was clean. These files would be replaced in Task 3 anyway, but Task 1's pre-commit hook needed them clean to commit at all.
- **Fix:** Applied `pnpm lint:fix` (auto-fixed `noBlankTarget`), then manually added `type="button"` to the demo button and replaced `getElementById!` with explicit null check + throw. These touches were preserved by Task 3's overwrite (which replaced the entire files anyway).
- **Files modified:** `apps/extension/entrypoints/popup/App.tsx`, `popup/main.tsx`.
- **Verification:** `pnpm lint` exits 0 with 24 files / 0 errors.
- **Committed in:** `2796da4` (Task 1)

**7. [Rule 3 - Blocking] WXT/Vite does NOT auto-resolve tsconfig.json `paths`; runtime alias missing**
- **Found during:** Task 3 (first `pnpm -F @platform/extension exec wxt prepare` after writing background.ts with `import { ... } from '@/shared/messages'`)
- **Issue:** WXT (and Vite) only honor aliases declared in `vite.resolve.alias` — they do NOT read `tsconfig.json`'s `paths` field. Vite's error message even says: "If you rely on tsconfig.json's 'paths' to resolve modules, please install 'vite-tsconfig-paths' plugin to handle module resolution." Plan's `wxt.config.ts` only declared `@experiments` alias.
- **Fix:** Added `'@/': '${resolve(__dirname, 'src')}/'` to the `vite.resolve.alias` in `wxt.config.ts`. Documented the duplication-with-tsconfig-paths in the file.
- **Files modified:** `apps/extension/wxt.config.ts`.
- **Verification:** `pnpm -F @platform/extension exec wxt prepare` succeeds; `pnpm -F @platform/extension build` succeeds with both content scripts and SW resolving `@/` imports.
- **Committed in:** `b940117` (Task 3)

**8. [Rule 3 - Blocking] Vitest 4 removed `defineWorkspace` — Plan 01-01's vitest.workspace.ts was a silent no-op**
- **Found during:** Task 2 (running `pnpm vitest run apps/extension/src/shared/storage.test.ts ...` for the first time; tests imported `chrome.*` but failed with `ReferenceError: chrome is not defined`)
- **Issue:** Plan 01-01 wrote `vitest.workspace.ts` using `defineWorkspace([...])` imported from `vitest/config`. Inspecting `vitest@4.1.5/dist/config.js` shows `defineWorkspace` is NOT exported — only `defineConfig` and `defineProject`. The import didn't crash because vitest probably treats unknown imports as `undefined` and the workspace file itself just exports its result. Vitest's CLI then ran every test file under the root config (which has no setupFiles, no aliases), so the `apps/extension/vitest.config.ts` (with the chrome-mock setupFile) was IGNORED. `packages/experiment-sdk` tests passed because they don't need chrome or aliases.
- **Fix:** Delete `vitest.workspace.ts`. Create root `vitest.config.ts` using `defineConfig({ test: { projects: [...] } })` (Vitest 4's official replacement for `defineWorkspace`). Project entries: `'./apps/*/vitest.config.ts'`, `'./packages/*/vitest.config.ts'`, plus an inline project for root-level test globs.
- **Files modified:** Created `vitest.config.ts` (repo root); deleted `vitest.workspace.ts`.
- **Verification:** `pnpm test --run` finds 6 test files / 43 tests, all green. The `apps/extension/vitest.config.ts` chrome-mock setupFile is now actually loaded.
- **Committed in:** `9369762` (Task 2)

---

**Total deviations:** 8 auto-fixed (3 Rule 3 - Blocking, 5 Rule 1 - Bug)
**Impact on plan:** All 8 deviations are version-/tool-specific reality checks that the plan could not have predicted from research alone:
- 3 are WXT 0.20.25 specifics (CLI flag, sandbox→utils import path, no tsconfig paths)
- 2 are TypeScript composite-project rules (explicit return types; allowImportingTsExtensions)
- 1 is a Vitest 4 breaking change (defineWorkspace → test.projects)
- 1 is a missing types entry (vite/client → wxt-managed types)
- 1 is the WXT scaffold's lint-incompatible defaults (replaced by Task 3 anyway)

None changed scope or required new tasks. Plan 04 (build plugin) and Plan 05 (CSP guardrail + spike doc) see the file paths and contracts the plan promised. The single non-trivial concept change is the Vitest workspace migration — which silently fixed broken behavior carried from Plan 01-01 (Plan 01-01 SUMMARY's tests "passed" because Vitest 4 was scanning files via the root config, masking that the workspace wiring was broken).

## Issues Encountered

- **Local Node v22.16.0 vs `engines.node >=24` warning** — pnpm prints `WARN Unsupported engine` on every command. All gates pass; carried forward from Plans 01-01 and 01-02. CI uses Node 24 per `.github/workflows/ci.yml`.
- **`Ignored build scripts: esbuild@0.27.7, lefthook@2.1.6, spawn-sync@1.0.15`** — pnpm safe-default postinstall blocking. Both esbuild and lefthook still function; `spawn-sync` is a deep transitive only used by Vitest's CLI plumbing. Carried forward from Plan 01-01.
- **No new blockers carried into Plan 04.**

## Threats Mitigated

- **T-1-02 (DoS / Information Disclosure — SW termination loses state silently):** mitigated. `apps/extension/src/shared/storage.ts` is the SOLE persistence path; zero module-scope state in the SW. Top-level listener registration in `background.ts` (line 20 < line 53) ensures the SW wakes on every event. Built `background.js` confirms the listener is in the IIFE body before `o.main()` runs.
- **T-1-03 (Information Disclosure / Tampering — cross-world leakage):** mitigated. Two separate entrypoint files (`content-isolated.content.ts`, `content-main.content.ts`) each declare their own `world` filter via `defineContentScript`. NO `chrome.scripting.executeScript` runtime injection. Built manifest emits TWO `content_scripts` blocks with distinct `world` values. The two scripts share no module instance.
- **T-1-04 (DoS — misbehaving experiment crashes engine for all others):** mitigated. `runEngine` and the inline reconcile loops in both content scripts wrap each `apply()` and each `cleanup()` in its own try/catch. Errors are logged AND stored under `last_error:<id>`. The error-isolation test proves a failing experiment does NOT prevent subsequent applies.
- **T-1-MS (Tampering — untyped messages from arbitrary origins):** partially mitigated. `isExtensionMessage` is the first check in every onMessage handler in both background.ts and the content scripts. Chrome-side: `chrome.runtime.onMessage` only fires for same-extension senders (popup, content scripts, devtools, options page). Closed-team trust model in PROJECT.md allows accepting validated message contents.

## User Setup Required

None — no external service configuration required for this plan. Plan 04 (build plugin + smoke experiment) will be the first to require a manual Chrome install for the loaded-extension smoke test.

## Next Phase / Plan Readiness

- **Plan 01-04 (build-experiments Vite plugin + smoke experiment)** — ready. Will:
  - import `ExperimentManifest` from `@platform/experiment-sdk`
  - scan `experiments/*/*/manifest.json` via `glob` (Node-side, build-time) — separate from the runtime `import.meta.glob` already wired in `content-isolated.content.ts` and `content-main.content.ts`
  - generate ULIDs for empty `id` fields, write back to manifest.json
  - register in `apps/extension/wxt.config.ts` `vite.plugins`
  - create `experiments/andrew/smoke/` so the popup renders one toggle
  - manual smoke: load `apps/extension/.output/chrome-mv3/` in Chrome, navigate to `https://ya.ru/`, toggle smoke ON → page background pink, toggle OFF → revert
- **Plan 01-05 (CSP guardrail + spike report)** — ready. Will:
  - ship `scripts/check-csp.ts`
  - re-enable the commented-out `check-csp` step in `lefthook.yml`
  - write `docs/spike/MV3-FOUNDATION.md` Section 5 (two-world routing — already empirically verified by this plan's built manifest)
  - measure WXT HMR latency (Section 2), dynamic import cache-busting (Section 3), SW idle termination (Section 4) — those need a running browser

No blockers carried into Plan 04.

## Self-Check: PASSED

Verified file presence:
- FOUND: apps/extension/package.json, tsconfig.json, wxt.config.ts, vitest.config.ts
- FOUND: apps/extension/entrypoints/background.ts, content-isolated.content.ts, content-main.content.ts
- FOUND: apps/extension/entrypoints/popup/App.tsx, main.tsx, index.html
- FOUND: apps/extension/src/shared/messages.ts, storage.ts, storage.test.ts, url-match.ts, url-match.test.ts
- FOUND: apps/extension/src/content/engine.ts, world-routing.test.ts, error-isolation.test.ts
- FOUND: apps/extension/src/test-setup/chrome-mock.ts
- FOUND: apps/extension/src/styles/popup.css
- FOUND: vitest.config.ts (root); vitest.workspace.ts intentionally deleted
- FOUND: tsconfig.json (root) modified with `./apps/extension` reference
- FOUND: apps/extension/.output/chrome-mv3/manifest.json (after `pnpm -F @platform/extension build`)

Verified commits in `git log --oneline`:
- FOUND: 2796da4 (Task 1 — chore: scaffold WXT extension app + Tailwind v4 + Vitest config)
- FOUND: 9369762 (Task 2 — feat: add engine pure modules + 28 vitest cases)
- FOUND: b940117 (Task 3 — feat: wire entrypoints — top-level SW listener, two-world content scripts, bare popup)

Verified gates exit 0:
- `pnpm install --frozen-lockfile` (OK)
- `pnpm typecheck` (OK; 3 project refs resolve)
- `pnpm lint` (OK; 31 files, 0 errors)
- `pnpm test --run` (OK; 6 files, 43 tests)
- `pnpm vitest run` for the four engine-pure-function suites (OK; 4 files, 28 tests)
- `pnpm -F @platform/extension build` (OK; produces .output/chrome-mv3/)

Verified built-manifest assertions:
- FOUND: 2 content_scripts entries
- FOUND: worlds list = ['ISOLATED', 'MAIN'] (ENG-03)
- FOUND: host_permissions = ['*://ya.ru/*', '*://*.ya.ru/*']
- FOUND: permissions = ['storage', 'tabs']
- FOUND: manifest_version = 3

Verified background SW assertions:
- FOUND: chrome.runtime.onMessage.addListener at module top (line 20)
- FOUND: export default defineBackground at line 53
- FOUND: line(addListener) < line(defineBackground)
- FOUND: built background.js IIFE registers addListener BEFORE o.main() invocation

---
*Phase: 01-foundation-spike-engine-skeleton*
*Plan: 03 — WXT Scaffold + Engine Skeleton*
*Completed: 2026-04-25*
