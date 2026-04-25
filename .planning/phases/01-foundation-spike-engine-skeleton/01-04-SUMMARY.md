---
phase: 01-foundation-spike-engine-skeleton
plan: 04
subsystem: build-tools
tags: [vite-plugin, ulid, glob, zod, manifest-validation, wxt, mv3, smoke-experiment]

# Dependency graph
requires:
  - phase: 01-01
    provides: pnpm workspace + tests/fixtures/manifests/{bad-world,empty-match}.json (used by tools tests) + Biome 2.4 lint
  - phase: 01-02
    provides: "@platform/experiment-sdk — ExperimentManifest Zod schema (D-16) + ApplyFn type (D-15) imported by build plugin and smoke experiment"
  - phase: 01-03
    provides: "apps/extension/wxt.config.ts (extended here to register the plugin) + Vite alias @experiments + content scripts that runtime-discover manifests via import.meta.glob"
provides:
  - "@platform/build-tools workspace package — Vite plugin buildExperiments() + pure helpers scanAndValidate / authorFromPath / formatErrors / findRepoRoot"
  - "Build-time discovery (BLD-01): globSync('experiments/*/*/manifest.json') from repo root"
  - "Build-time validation (BLD-02): ExperimentManifest.safeParse on every manifest; failures throw a formatted multi-line error inside Vite's buildStart hook"
  - "ULID auto-generation (D-17): empty/missing id → generate ULID via ulid@^3.0.2, write back JSON.stringify(v,null,2)+\\n preserving canonical shape, log + warn"
  - "Author-vs-folder check (D-18): manifest.author must match the path segment after experiments/"
  - "Smoke experiment (D-28 verbatim): experiments/andrew/smoke/{manifest.json,experiment.ts} — pinks ya.ru via body { background: pink !important; }; ULID 01KQ2WMYX5Z2TZS1GEE6598ERF stamped on first run"
  - "Plugin registered in apps/extension/wxt.config.ts vite.plugins; runs on every wxt prepare and wxt build"
  - "13 Vitest cases in tools/build-experiments.test.ts (authorFromPath x3, discovery x2, ULID idempotency x2, Zod errors x3, author mismatch x2, JSON parse x1)"
  - "Biome formatter exclusion for experiments/**/manifest.json — preserves the plugin's idempotent JSON shape (mirrors tests/fixtures exclusion from Plan 01-01)"
affects: [Plan 01-05 (CSP guardrail will scan experiments/ — same files; spike doc records first stamped ULID), Phase 2 (BLD-03 will emit dist/registry.json from the same ManifestEntry list this plugin already produces; BLD-04 will code-split each experiment), Phase 6 (designer onboarding adds new experiments/<author>/<id>/manifest.json files; plugin auto-stamps ULIDs the same way)]

# Tech tracking
tech-stack:
  added:
    - "glob@^11.0.0 (Node-side build-time discovery; resolved 11.1.0)"
    - "ulid@^3.0.2 (Crockford ULID generation; resolved 3.0.2)"
    - "vite@^8.0.10 (devDep; type-only — Plugin signature)"
  patterns:
    - "Build-time discovery + validation as a Vite plugin (Group D / SP-3): single buildStart hook scans, ULID-stamps, validates, and enforces author convention; build fails fast with formatted error on any violation."
    - "Idempotent file write-back: only when id is empty/missing/null. Once stamped, second run produces zero diff. Tested via two consecutive scans + byte-comparison of the file."
    - "Pure helpers exposed for unit testing: buildExperiments() is the plugin shell; scanAndValidate / authorFromPath / formatErrors are pure and individually tested."
    - "Plugin root override (root: repoRoot): Vite's cwd inside an apps/extension/ build is NOT the repo root, so the plugin accepts an explicit root option that wxt.config.ts derives from import.meta.url. Critical for monorepo Vite plugins that walk repo-relative paths."
    - "Manifest formatting exclusion: experiments/**/manifest.json excluded from Biome to preserve the JSON.stringify(v,null,2)+\\n shape the plugin writes — same pattern as tests/fixtures (Plan 01-01)."

key-files:
  created:
    - "tools/build-experiments.ts — Vite plugin (buildExperiments) + pure helpers (scanAndValidate, authorFromPath, formatErrors, findRepoRoot); ~165 LOC"
    - "tools/build-experiments.test.ts — 13 Vitest cases; ~205 LOC"
    - "tools/package.json — @platform/build-tools workspace package; deps: glob ^11, ulid ^3.0.2, zod ^4.3.6, @platform/experiment-sdk; devDeps: vite ^8, vitest ^4"
    - "experiments/andrew/smoke/manifest.json — D-28 verbatim; ULID 01KQ2WMYX5Z2TZS1GEE6598ERF (auto-stamped by plugin on first run)"
    - "experiments/andrew/smoke/experiment.ts — D-28 verbatim; ApplyFn that injects pink background on body and returns cleanup that removes the style"
    - "experiments/.gitkeep — keep the experiments/ directory tracked in git"
  modified:
    - "pnpm-workspace.yaml — added tools entry to packages glob"
    - "apps/extension/wxt.config.ts — registered buildExperiments({ root: repoRoot }) in vite.plugins; preserved Plan 03's @experiments + @/ aliases"
    - "apps/extension/package.json — added @platform/build-tools: workspace:* to devDependencies"
    - "biome.json — added !experiments/**/manifest.json to files.includes so Biome leaves the plugin-written JSON shape untouched"
    - "pnpm-lock.yaml — added @platform/build-tools workspace entry + glob 11.1.0 + ulid 3.0.2 (transitive: package-json-from-dist, jackspeak, foreground-child, signal-exit, etc.)"

key-decisions:
  - "Plugin accepts root: BuildExperimentsOptions.root override — required because the WXT app's Vite cwd is apps/extension/, not the repo root. wxt.config.ts derives repoRoot from import.meta.url via fileURLToPath + dirname + resolve('../..')."
  - "biome.json now excludes experiments/**/manifest.json from the formatter — Biome's array compaction would conflict with the plugin's idempotent JSON.stringify(v,null,2)+\\n write-back. Same pattern Plan 01-01 used for tests/fixtures."
  - "ULID write-back triggers on id missing OR id === '' OR id == null — the plan said 'empty/missing'; the actual implementation also handles explicit null for forward-compatibility with malformed designer commits."
  - "scanAndValidate returns errors as a structured array (kind: parse | schema | author-mismatch); only buildExperiments() throws inside buildStart. Mitigates T-1-01 cleanly: malformed JSON does NOT crash the plugin's scan — it produces a parse error in the result array, which the orchestrator formats into a single thrown Error."
  - "Test file uses fileURLToPath(import.meta.url) to locate REPO_ROOT and FIXTURES_DIR, instead of process.cwd() — guarantees fixture lookup works regardless of where vitest is invoked from."

patterns-established:
  - "Vite-plugin shape for monorepo build-time codegen (Group D in 01-PATTERNS): named export, options bag with root override, buildStart hook, structured ScanResult with errors+warnings, plugin name 'platform:<purpose>'. Phase 2 BLD-03 will follow the same shape to emit dist/registry.json."
  - "Designer-facing manifest formatting: Biome excludes experiments/**/manifest.json. Designers committing new manifests with empty id receive plugin-formatted output unchanged on disk. Future plans (Phase 2+) need not re-establish this rule."
  - "Workspace-root resolution from a nested Vite plugin: pass root explicitly from wxt.config.ts (derived from import.meta.url) — never rely on process.cwd() inside the plugin."

requirements-completed: [BLD-01, BLD-02, ENG-01]

# Metrics
duration: 5min46s
completed: 2026-04-25
---

# Phase 1 Plan 04: Build-experiments Vite Plugin + Smoke Summary

**`@platform/build-tools` Vite plugin that discovers `experiments/*/*/manifest.json` via Node `glob`, auto-stamps ULIDs (`01KQ2WMYX5Z2TZS1GEE6598ERF` written to the smoke manifest on first run), Zod-validates against the SDK schema, enforces `manifest.author === <folder>`, registers into WXT, and ships the D-28 smoke experiment that pinks ya.ru — proven by 13 unit tests + a clean `pnpm -F @platform/extension build` and a clean second-run idempotency check.**

## Performance

- **Duration:** 5min46s
- **Started:** 2026-04-25T17:54:06Z
- **Completed:** 2026-04-25T17:59:52Z
- **Tasks:** 2
- **Files created:** 6 (tools/{build-experiments.ts, build-experiments.test.ts, package.json}, experiments/{andrew/smoke/manifest.json, andrew/smoke/experiment.ts, .gitkeep})
- **Files modified:** 5 (pnpm-workspace.yaml, apps/extension/wxt.config.ts, apps/extension/package.json, biome.json, pnpm-lock.yaml)

## Accomplishments

- `pnpm -F @platform/extension build` now runs the full discover → ULID-stamp → Zod-validate → bundle pipeline on every invocation. After this plan, designers writing a new `experiments/<author>/<id>/manifest.json` with `"id": ""` get an auto-stamped ULID and a one-line console reminder to commit it.
- The smoke experiment is structurally complete: `experiments/andrew/smoke/manifest.json` (id `01KQ2WMYX5Z2TZS1GEE6598ERF`) + `experiment.ts` (D-28 verbatim) + a corresponding chunk inlined into `apps/extension/.output/chrome-mv3/content-scripts/content-isolated.js` (verified via `grep "smoke" content-isolated.js` → 3 matches; `grep "background:" content-isolated.js` → 1 match).
- BLD-01 (build-time discovery via the Node glob) and BLD-02 (Zod validation at build) are now satisfied. ENG-01 is structurally complete — the manual ya.ru smoke (load extension, toggle, see pink) is physically possible; Plan 05 owns the manual verification.
- Plugin behavior is exhaustively tested: 13 `it()` cases covering `authorFromPath` (3 paths × valid/invalid depth/wrong root), discovery (2 — exact-depth glob + empty), ULID write-back (2 — stamps when empty + idempotent on re-scan), Zod errors (3 — `world` enum, `scope.match` min, formatErrors output shape), author-vs-folder (2 — mismatch fails + match passes), JSON parse failure (1 — malformed input → kind 'parse').
- Threats T-1-01 (manifest crashes build) and T-1-06 (manifest.author ≠ folder) are mitigated at the build boundary — the plugin produces structured errors and Vite turns them into build failures with the file path, dotted field path, and Zod issue message.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build plugin + tests + tools workspace package** — `d2f2a7f` (feat)
2. **Task 2: Smoke experiment + WXT plugin registration + first build** — `2df761f` (feat)

**Plan metadata commit:** pending (after this SUMMARY.md + STATE.md/ROADMAP.md updates).

## Verified-Running Commands

| Command | Status | Notes |
|---------|--------|-------|
| `pnpm install --frozen-lockfile` | OK | Workspace now contains apps + packages + tools (4 projects); postinstall runs `wxt prepare` which fires the plugin (no-op now that the smoke ULID is stamped) |
| `pnpm typecheck` | OK | tsc -b --pretty — all three project refs (root → SDK + extension; tools is checked transitively when extension imports it) |
| `pnpm lint` | OK | Biome checks 35 files, 0 errors |
| `pnpm vitest run tools/build-experiments.test.ts` | OK | 13/13 tests pass; ~200ms |
| `pnpm test --run` | OK | 7 test files / 56 tests pass total (1 sanity + 14 SDK + 28 extension + 13 tools) |
| `pnpm -F @platform/extension build` | OK | Produces `.output/chrome-mv3/{manifest.json, background.js, content-scripts/{content-isolated,content-main}.js, popup.html, ...}` — 390.46 kB total. Second invocation does NOT log "Wrote new id" (idempotency confirmed). |

## Built-Manifest Verification

After `pnpm -F @platform/extension build`:

- `apps/extension/.output/chrome-mv3/manifest.json` exists, MV3, with the same 2 `content_scripts` entries (ISOLATED + MAIN) Plan 03 established.
- `apps/extension/.output/chrome-mv3/content-scripts/content-isolated.js` contains the smoke experiment's bundled `apply` (string `smoke` and the literal `background: pink !important;` are present in the chunk).

## Smoke Manifest After First Run

```json
{
  "id": "01KQ2WMYX5Z2TZS1GEE6598ERF",
  "name": "Smoke pink",
  "author": "andrew",
  "description": "Turns ya.ru pink to verify foundation",
  "scope": {
    "match": [
      "*://*.ya.ru/*",
      "*://ya.ru/*"
    ]
  },
  "world": "isolated",
  "tweaks": []
}
```

ULID `01KQ2WMYX5Z2TZS1GEE6598ERF` matches `^[0-9A-HJKMNP-TV-Z]{26}$` (verified inline via Python).

## First-Build Plugin Output (Wrote new id)

The plugin actually fired during the first **`pnpm install`** run — the WXT app's `postinstall: wxt prepare` triggers a Vite buildStart, which runs the plugin. The captured log line:

```
apps/extension postinstall: [build-experiments] Wrote new id to experiments/andrew/smoke/manifest.json — please commit
```

This means the manifest's `id` was already stamped by the time my explicit `pnpm -F @platform/extension build` ran the first time. See "Deviations" below for the workflow note.

## Second-Build Idempotency Check

```bash
$ pnpm -F @platform/extension build 2>&1 | grep -E "Wrote new id|Built extension"
✔ Built extension in 396 ms
```

No "Wrote new id" log on the second run. The manifest file is byte-identical between consecutive builds (covered by the `is idempotent` test in `tools/build-experiments.test.ts`). Idempotency confirmed — D-17.

## Resolved Lockfile Versions (vs. Plan pins)

| Package | Plan pin | Resolved | Notes |
|---------|----------|----------|-------|
| `glob` | `^11.0.0` | `11.1.0` | exact (deprecation note from npm refers to a specific minor; functionally OK; plan accepted floating to latest 11.x) |
| `ulid` | `^3.0.2` | `3.0.2` | exact |
| `vite` | `^8.0.10` | (devDep type-only; not bundled) | exact, transitive presence already established by WXT in Plan 03 |

## Files Created (6)

- `tools/build-experiments.ts` — Vite plugin + pure helpers
- `tools/build-experiments.test.ts` — 13 Vitest cases
- `tools/package.json` — workspace package metadata
- `experiments/andrew/smoke/manifest.json` — D-28 smoke manifest with stamped ULID
- `experiments/andrew/smoke/experiment.ts` — D-28 smoke ApplyFn (pinks ya.ru)
- `experiments/.gitkeep` — keep experiments/ tracked

## Files Modified (5)

- `pnpm-workspace.yaml` — added `tools` entry
- `apps/extension/wxt.config.ts` — imported and registered `buildExperiments({ root: repoRoot })`
- `apps/extension/package.json` — added `@platform/build-tools: workspace:*` to devDependencies
- `biome.json` — added `!experiments/**/manifest.json` exclusion
- `pnpm-lock.yaml` — workspace + new transitives (glob 11.1.0 family + ulid 3.0.2)

## Decisions Made

- **Plugin accepts a `root` option (`BuildExperimentsOptions.root`)** — Vite's cwd inside `apps/extension/` is NOT the repo root, so the plugin must be told where to start globbing. `wxt.config.ts` derives the path from `import.meta.url` via `fileURLToPath + dirname + resolve('../..')`. Falling back to `process.cwd()` works only when Vite is invoked from the repo root, which is brittle.
- **`biome.json` excludes `experiments/**/manifest.json`** — the plugin writes manifests in canonical Node `JSON.stringify(v, null, 2) + '\n'` shape (matching `tests/fixtures` from Plan 01-01). Biome's JSON formatter would compact short arrays inline, which would silently diff against the plugin's output and either trigger a fresh write-back next build or break the idempotency contract. Same exclusion pattern as fixtures — designer-authored manifests are governed by the plugin's contract, not Biome's style.
- **`scanAndValidate` returns errors instead of throwing** — only the plugin's `buildStart` orchestrator throws `new Error(formatErrors(...))` to surface the failure to Vite. Pure helpers stay testable without try/catch.
- **`scanAndValidate` treats `id == null` AND `id === ''` AND `'id' in obj === false` as "missing"** — plan said "empty/missing"; null is forward-compatible with designers who type literal `null` in JSON. ULID is generated regardless of which falsy variant they used.
- **Test fixture-loading via `fileURLToPath(import.meta.url)`** — `process.cwd()` would have made the test brittle to runner invocation directory. Using the test file's own URL guarantees correct resolution from any cwd.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Biome formatter compacts the smoke manifest's `scope.match` array**
- **Found during:** Task 2 (`pnpm lint` after creating `experiments/andrew/smoke/manifest.json`)
- **Issue:** Biome's JSON formatter compacted `"match": ["*://*.ya.ru/*", "*://ya.ru/*"]` onto a single line, but the plugin writes manifests using `JSON.stringify(v, null, 2) + '\n'` which expands arrays. The plugin's idempotency contract (D-17) requires the file shape on disk to match what the plugin would write, otherwise lint conflicts with build behavior.
- **Fix:** Added `"!experiments/**/manifest.json"` to `biome.json` `files.includes` — same pattern Plan 01-01 used for `tests/fixtures`.
- **Files modified:** `biome.json`
- **Verification:** `pnpm lint` exits 0; the plugin's idempotency tests still pass; the smoke manifest's on-disk shape matches what the plugin would write.
- **Committed in:** `2df761f` (Task 2 commit, alongside the smoke files since the conflict was discovered as a direct result of writing the smoke manifest).

**2. [Rule 1 - Bug] Removed dead `biome-ignore` suppression comment**
- **Found during:** Task 1 (first `pnpm lint` after writing `tools/build-experiments.ts`)
- **Issue:** I had pre-emptively added `// biome-ignore lint/suspicious/noConsole: build-time tooling output is intentional` above the `console.log(msg)` call. Biome's recommended ruleset does NOT include `noConsole`, so the suppression was unused — Biome flagged it with `suppressions/unused`.
- **Fix:** Removed the unused suppression comment. The plain `console.log` is fine because the rule isn't enabled.
- **Files modified:** `tools/build-experiments.ts`
- **Verification:** `pnpm lint` exits 0.
- **Committed in:** `d2f2a7f` (Task 1 commit, fix made before staging).

### Process Deviation (not auto-fixed; documented)

**3. [Process — workflow timing] First ULID write-back happened during `pnpm install` postinstall, not during the explicit `pnpm -F @platform/extension build` step**
- **Found during:** Task 2, Step 5 (first build)
- **What happened:** The plan's expected workflow was: (a) commit smoke manifest with `"id": ""`; (b) run `pnpm -F @platform/extension build` and observe the "Wrote new id" log; (c) follow-up commit captures the stamped ULID. In practice, `apps/extension/package.json` declares `"postinstall": "wxt prepare"` (preserved from Plan 03's WXT scaffold), and `wxt prepare` runs Vite's full plugin chain. So the first time I ran `pnpm install` after registering the plugin in `wxt.config.ts`, the postinstall fired the plugin, the plugin saw `"id": ""`, and stamped the ULID before I could commit the empty-id state. The output `apps/extension postinstall: [build-experiments] Wrote new id to experiments/andrew/smoke/manifest.json — please commit` was captured in the install log.
- **End state:** Identical to the plan's intended end state — the smoke manifest has a valid stamped ULID (`01KQ2WMYX5Z2TZS1GEE6598ERF`); Task 2's commit `2df761f` includes both the registered plugin AND the stamped ULID together.
- **Why this is fine:** The "split commits" expectation in the plan was a workflow nicety (one commit for the empty id, one for the stamp) — the contract was D-17 idempotency. That contract is empirically demonstrated by the second-build check (no "Wrote new id" log) and by the unit test suite. Future designers adding new experiments will see "Wrote new id" the first time they run `pnpm install` or `pnpm dev`, and they will have to commit the diff — same outcome, same instruction.

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - Blocking, 1 Rule 1 - Bug) + 1 documented process timing.
**Impact on plan:** Both auto-fixes were necessary to keep `pnpm lint` green; neither changed behavior or scope. The process timing note documents that the WXT scaffold's `postinstall: wxt prepare` (set up by Plan 03) means designers see the ULID stamp during install, not during their first explicit build — informational only.

## Issues Encountered

- **Local Node v22.16.0 vs `engines.node >=24` warning** — pnpm prints `WARN Unsupported engine` on every command. All gates pass; carried forward from Plans 01-01/02/03. CI uses Node 24.
- **`Ignored build scripts: esbuild, lefthook, spawn-sync`** — pnpm safe-default postinstall blocking. Carried forward; both packages function.
- **glob@11.1.0 deprecation note from npm** — pnpm prints `WARN deprecated glob@11.1.0` on install. Functional; this is the latest 11.x. The plan accepted floating within the 11.x range. If glob 12.x lands as a hard requirement later, only the version pin in `tools/package.json` needs updating; the API used (`globSync(pattern, { cwd, absolute })`) is stable across 10.x/11.x/12.x.
- **No new blockers carried into Plan 05.**

## Threats Mitigated

- **T-1-01 (Tampering / DoS — malformed manifest crashes build):** mitigated at the build boundary. `scanAndValidate` returns structured errors for parse, schema, and author-mismatch failures; only the orchestrator-level `buildExperiments.buildStart` formats them via `formatErrors` and throws — Vite then surfaces a readable build failure with the file path, dotted field path, and Zod issue message. Tested by 4 cases (`bad-world.json`, `empty-match.json`, `formatErrors output shape`, `JSON parse failure`).
- **T-1-06 (Spoofing — manifest.author claims a different author than the folder):** mitigated. `authorFromPath(fileRel)` extracts the segment between `experiments/` and `/<id>/manifest.json` and `scanAndValidate` produces an `author-mismatch` error if `parsed.data.author !== expectedAuthor`. Tested by 2 cases (`throws when ... does not match`, `passes when ... matches`).
- **T-1-WB (accepted — plugin writes back to manifest):** still accepted. Write-back fires only when `id` is empty/missing/null. Idempotency proven by the dedicated test (two consecutive scans, byte-comparison of file before+after). The `Wrote new id` log line is the designer's signal to commit the diff — verified by the captured install-time output above.

## User Setup Required

None — no external service configuration required for this plan. Plan 05 will be the first plan that requires a manual Chrome install for the loaded-extension smoke (load `apps/extension/.output/chrome-mv3/`, navigate to ya.ru, toggle smoke ON → background pink).

## Next Phase / Plan Readiness

- **Plan 01-05 (CSP guardrail + spike report)** — ready. Will:
  - ship `scripts/check-csp.ts` and re-enable the commented-out `check-csp` step in `lefthook.yml`
  - write `docs/spike/MV3-FOUNDATION.md` Sections 1-5; the Section 5 (two-world routing) and Section 4 (SW lifecycle) findings are already empirically captured in Plan 03 SUMMARY's "Built Manifest Inspection" and "Background SW Listener Order" tables — Plan 05 distills them into the spike doc
  - perform the manual smoke (load `apps/extension/.output/chrome-mv3/` in Chrome, navigate to `https://ya.ru/`, toggle smoke ON → page background pink, toggle OFF → revert) and document in the spike doc
  - measure HMR latency, dynamic import cache-busting, and SW idle termination wall-clock — those need a running browser
- **Phase 2** — `BLD-03` (`dist/registry.json`) will consume the `ManifestEntry[]` shape this plugin already produces. The next planner can reuse `scanAndValidate` and add a `writeBundle` hook that emits the registry.

No blockers carried into Plan 05.

## Self-Check: PASSED

Verified file presence:
- FOUND: tools/build-experiments.ts
- FOUND: tools/build-experiments.test.ts
- FOUND: tools/package.json
- FOUND: experiments/andrew/smoke/manifest.json (with stamped ULID)
- FOUND: experiments/andrew/smoke/experiment.ts
- FOUND: experiments/.gitkeep
- FOUND (modified): pnpm-workspace.yaml, apps/extension/wxt.config.ts, apps/extension/package.json, biome.json, pnpm-lock.yaml
- FOUND: apps/extension/.output/chrome-mv3/manifest.json (built artifact)

Verified commits in `git log --oneline`:
- FOUND: d2f2a7f (Task 1 — feat: add @platform/build-tools build-experiments Vite plugin)
- FOUND: 2df761f (Task 2 — feat: wire smoke experiment + register buildExperiments plugin in WXT config)

Verified gates exit 0:
- `pnpm install --frozen-lockfile` (OK)
- `pnpm typecheck` (OK; project refs resolve)
- `pnpm lint` (OK; 35 files, 0 errors)
- `pnpm vitest run tools/build-experiments.test.ts` (OK; 13/13 tests pass)
- `pnpm test --run` (OK; 7 files, 56 tests)
- `pnpm -F @platform/extension build` (OK; .output/chrome-mv3/ ~390.46 kB)

Verified content checks:
- FOUND: `export function buildExperiments(` in tools/build-experiments.ts
- FOUND: `export function scanAndValidate` in tools/build-experiments.ts
- FOUND: `export function authorFromPath` in tools/build-experiments.ts
- FOUND: `export function formatErrors` in tools/build-experiments.ts
- FOUND: `name: 'platform:build-experiments'` plugin name
- FOUND: `buildExperiments({ root: repoRoot })` in apps/extension/wxt.config.ts vite.plugins
- FOUND: `"@platform/build-tools": "workspace:*"` in apps/extension/package.json devDependencies
- FOUND: `"author": "andrew"`, `"name": "Smoke pink"`, `"world": "isolated"` in experiments/andrew/smoke/manifest.json
- FOUND: ULID `01KQ2WMYX5Z2TZS1GEE6598ERF` matches `^[0-9A-HJKMNP-TV-Z]{26}$`
- FOUND: `import type { ApplyFn } from '@platform/experiment-sdk'` in experiment.ts
- FOUND: `background: pink !important;` in experiment.ts
- FOUND: `style.dataset.expId = 'smoke'` in experiment.ts
- FOUND: `!experiments/**/manifest.json` in biome.json files.includes

---
*Phase: 01-foundation-spike-engine-skeleton*
*Plan: 04 — Build-experiments Vite Plugin + Smoke Experiment*
*Completed: 2026-04-25*
