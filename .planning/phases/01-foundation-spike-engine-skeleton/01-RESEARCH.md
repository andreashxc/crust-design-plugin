# Phase 1: Foundation Spike & Engine Skeleton — Research

**Researched:** 2026-04-25
**Domain:** Chromium MV3 extension foundation — WXT scaffold, two-world engine skeleton, build-time experiment discovery, CI guardrails, spike validation
**Confidence:** MEDIUM-HIGH (architecture HIGH, version pins verified live against npm, CRXJS/WXT spike findings are LOW until empirically run)

> **Verification posture:** Every version below verified live with `npm view <pkg> version` on 2026-04-25. Architectural recommendations build on `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` — this document does NOT redo that work; it concretizes Phase 1 only. Items tagged `[ASSUMED]` are those that the spike itself must empirically confirm — they are explicitly the deliverables of `docs/spike/MV3-FOUNDATION.md`, not facts to be locked into the plan.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack & Tooling**
- **D-01:** WXT (`~0.20.x`) as the framework. Wraps Vite, file-based entrypoints, content-script HMR. Spike must confirm HMR-contract matches ARCHITECTURE.md; otherwise Phase 5 design adjusts.
- **D-02:** TypeScript 5.6+ for everything (extension, SDK, experiments). Designers write experiments in TS via `experiment-sdk` types.
- **D-03:** Zod `~3.23+` for manifest + runtime boundaries. *(Note: live npm shows 4.3.6 — see Stack table.)*
- **D-04:** Zustand `~5.x` reserved for popup state (Phase 2; not used in Phase 1).
- **D-05:** shadcn/ui (latest CLI) + Tailwind v4 + React 19. Phase 1 sets up; only renders bare popup-toggle.
- **D-06:** Biome (single binary, ~10× ESLint+Prettier). Custom CSP regex check.
- **D-07:** Vitest for unit tests in Phase 1. Minimum: Zod manifest schema, URL-scope matcher.
- **D-08:** pnpm workspaces. No Nx/Turborepo.
- **Pre-lockfile verification:** `npm view <pkg> version` for wxt, react, tailwindcss, shadcn, zod, zustand, vitest, biome — fix actual values before `pnpm install`.

**Repository Layout (D-09 / D-10 / D-11)**
```
/
├── apps/extension/        # WXT project: manifest, popup, content, background
├── packages/experiment-sdk/  # Zero-runtime types, split now (cheap; expensive later)
├── experiments/<author>/<id>/  # Designers' working dir (root-level, NOT inside apps/)
├── docs/spike/MV3-FOUNDATION.md
├── tools/build-experiments.ts  # Vite plugin: glob + Zod + chunk-emit
├── pnpm-workspace.yaml
├── package.json
└── biome.json
```

**Engine Architecture**
- **D-12:** Service worker stateless. No `let cache = …` at module scope. State in `chrome.storage.local`. Spike validates: stop SW via `chrome://serviceworker-internals` → trigger event → apply/cleanup must work.
- **D-13:** Two-world routing **declarative through manifest**. Manifest field `world: 'isolated' | 'main'` (default `isolated`). Plugin manifest declares two `content_scripts` entries — one `world: ISOLATED`, one `world: MAIN` — each loads its own entry-content-script. Engine in each world filters registry by `world` and loads only its experiments. NO runtime `chrome.scripting.executeScript` injections in Phase 1. NO bridge between worlds in Phase 1.
- **D-14:** Error isolation. Engine wraps every `apply()` and `cleanup()` in try/catch. Logged to console + `chrome.storage.local` last-error. Auto-disable after N errors → Phase 2.
- **D-15:** Engine contract (in `experiment-sdk`):
  ```ts
  type ApplyArgs = {
    tweaks: Record<string, unknown>;     // {} in Phase 1
    helpers: Helpers;                     // { log } only in Phase 1
    currentURL: string;
    log: (msg: string, ...args: unknown[]) => void;
    signal: AbortSignal;
  };
  type ApplyFn = (args: ApplyArgs) => CleanupFn | Promise<CleanupFn>;
  type CleanupFn = () => void | Promise<void>;
  ```
  `Helpers` full schema (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`, `llm`, `fetchPage`) → Phase 4.

**Manifest Schema (v1)**
- **D-16:** Zod schema for `experiments/<author>/<id>/manifest.json`:
  ```ts
  const ExperimentManifest = z.object({
    id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),  // ULID (Crockford base32, no I/L/O/U)
    name: z.string().min(1),
    author: z.string().min(1),                          // must match folder name
    description: z.string().min(1).max(280),
    scope: z.object({
      match: z.array(z.string()).min(1),                // Chrome match-patterns
      regex: z.array(z.string()).optional(),            // Phase 3 (MAN-02)
    }),
    world: z.enum(['isolated', 'main']).default('isolated'),
    tweaks: z.array(z.unknown()).default([]),           // full schema → Phase 3 (TWK-01)
  });
  ```
- **D-17:** ULID auto-generated at first build. If `id` missing/empty, build-time tool generates ULID, writes back to file, prints `Wrote new id to {path} — please commit`. Never touched again.
- **D-18:** Build-time validation: `experiments/<author>/<id>/manifest.json` — if `manifest.author ≠ <author>` from path, build fails.
- **D-19:** `description` is short (1-280 chars). Full `description.md` → Phase 5 (DX-03).

**Build Pipeline**
- **D-20:** Discovery — Vite plugin (or WXT hook) using `import.meta.glob('experiments/*/*/manifest.json', {eager: true})` and `import.meta.glob('experiments/*/*/experiment.ts')`. Each experiment compiled to its own chunk.
- **D-21:** Manifest validation — Vite plugin runs each manifest through Zod at build. Invalid → build fails with file, field, readable error.
- **D-22:** Phase 1 does NOT emit `dist/registry.json` (that is BLD-03 in Phase 2). Phase 1 registry lives in-memory in content scripts via `import.meta.glob({eager:true})`.

**CI / Linting**
- **D-23:** Biome + custom regex check on `src/` and `experiments/` for: `\beval\s*\(`, `\bnew\s+Function\s*\(`, `import\s*\(\s*['"]https?://`. Implemented as `scripts/check-csp.ts`, called from `pnpm lint` and pre-commit.
- **D-24:** Pre-commit hook + GitHub Actions `.github/workflows/ci.yml` — both run `pnpm lint`, `pnpm typecheck`, `pnpm test`. CI required for merge.

**Spike Approach**
- **D-25:** Spike grows into foundation. No throwaway prototype.
- **D-26:** Output document `docs/spike/MV3-FOUNDATION.md` covers 5 sections: WXT vs CRXJS reconciliation, content-script HMR verified-vs-broken, dynamic import cache-busting, SW idle termination, two-world routing.
- **D-27:** SW lifecycle smoke check: `chrome://serviceworker-internals` → "stop" → toggle smoke experiment → must apply/cleanup correctly. Closes success criterion #5.

**Smoke Experiment**
- **D-28:** Pure CSS minimum. `experiments/andrew/smoke/`:
  - `manifest.json`: ULID, `name: "Smoke pink"`, `author: "andrew"`, `description: "Turns ya.ru pink to verify foundation"`, `scope.match: ["*://*.ya.ru/*", "*://ya.ru/*"]`, `world: "isolated"`, `tweaks: []`.
  - `experiment.ts`: appends `<style data-exp-id="smoke">body { background: pink !important; }</style>` to head; cleanup removes it.
- **D-29:** Popup is bare-bones list with one toggle. No shadcn cards, no author grouping (all → Phase 2/3).

### Claude's Discretion
- File names within `apps/extension/src/` (background, content, popup organization)
- Exact `wxt.config.ts` structure
- Exact lockfile pins after `npm view` verification
- CSS file placement
- Pre-commit hook manager choice (`lefthook` recommended; `husky` acceptable)
- Logger format inside `log()`
- Anything not explicitly listed in Locked Decisions

### Deferred Ideas (OUT OF SCOPE)
- Auto-tracked helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) → Phase 4 (HLP-08)
- Tweak engine (auto-render shadcn controls, Zod-validation values) → Phase 3 (TWK-01..07)
- Full popup (author grouping, statuses, URL filter, drag-and-drop ordering) → Phase 2 + Phase 5
- `dist/registry.json` artifact + per-experiment code-split chunks → Phase 2 (BLD-03, BLD-04)
- Stable ULID decoupled from path (rename folder doesn't lose state) → Phase 2 (MAN-03)
- Auto-disable after N errors → Phase 2 (ENG-06)
- Hot-reload dev mode (file-watcher → RE_APPLY_EXPERIMENT) → Phase 5 (DX-01)
- `description.md` auto-generated by Cursor → Phase 5 (DX-03)
- Two-world bridge (CustomEvent / shared window between isolated and main of same experiment) → deferred to real case
- Yandex Browser smoke test → Phase 6 (DIST-03)
- `.crx` packaging + GitHub Releases workflow → Phase 6 (DIST-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|------------------------------------|------------------|
| ENG-01 | Extension builds under Chromium MV3 and installs via "load unpacked" / sideload `.crx` | WXT scaffold + `wxt build`; smoke target is Chrome stable. Validation: open `chrome://extensions`, enable Developer mode, "Load unpacked" → `apps/extension/.output/chrome-mv3` |
| ENG-02 | SW holds no in-memory state; everything in `chrome.storage.local` (survives ~30s idle termination) | Stateless SW pattern (PITFALLS Pitfall 1, ARCHITECTURE Pattern 1). Validation: `chrome://serviceworker-internals` → "stop" → trigger event → state survives. Top-level listener registration mandatory. |
| ENG-03 | Engine routes experiments between isolated-world and MAIN-world via manifest field | Declarative two-world routing (D-13): two `content_scripts` blocks in plugin manifest, each loads own entry; engine filters by world. NO `chrome.scripting.executeScript` in Phase 1. |
| ENG-05 | Engine wraps `apply()`/`cleanup()` in try/catch — single experiment error doesn't break others | Error isolation (D-14, ARCHITECTURE Anti-Pattern, PITFALLS Pitfall 8). Wrap every call site individually. Log to console + `chrome.storage.local.last_errors[id]`. |
| BLD-01 | Build discovers experiments under `experiments/<username>/<id>/` via `import.meta.glob` (static, no runtime fetch — MV3 CSP) | Vite plugin uses `import.meta.glob('experiments/*/*/manifest.json', {eager: true})` and `import.meta.glob('experiments/*/*/experiment.ts')`. Statically analyzable by Rollup → MV3-compliant. |
| BLD-02 | Each experiment Zod-validated at build; invalid manifest fails build with readable error | Vite plugin runs every manifest through `ExperimentManifest.safeParse()`; failure formats Zod issues with file path + dotted field path + message. |
| BLD-05 | CI lint fails on `eval`, `new Function`, dynamic `import("https://...")` | `scripts/check-csp.ts` with three regex patterns; runs in `pnpm lint`, pre-commit (lefthook), and GitHub Actions. Fails on first match with file:line:column. |
| MAN-01 | Manifest is `manifest.json` with: id, name, author, description, scope (URL patterns), world (`isolated`\|`main`), tweaks[] | Zod schema (D-16). `tweaks` is opaque `z.array(z.unknown()).default([])` in Phase 1; full discriminated union → Phase 3. |
</phase_requirements>

---

## Phase Goal Restated

Empirically de-risk the five highest-cost-to-rewrite MV3 unknowns and ship a loadable Chromium extension skeleton on which every later phase will build. The phase succeeds when:

1. `pnpm build` produces an unpacked extension in `apps/extension/.output/chrome-mv3/` that loads cleanly via "Load unpacked" in Chrome stable.
2. The smoke experiment `experiments/andrew/smoke/` turns `*://ya.ru/*` and `*://*.ya.ru/*` pink on enable, reverts cleanly on disable, survives an SW restart.
3. The build pipeline discovers experiments via `import.meta.glob`, Zod-validates manifests, fails the build with a readable error on schema violation.
4. CI blocks any commit containing `eval`, `new Function`, or remote `import("https://...")` in `src/` or `experiments/`.
5. `docs/spike/MV3-FOUNDATION.md` is committed with verified-vs-broken findings on: (a) WXT vs CRXJS reconciliation, (b) content-script HMR, (c) dynamic-import cache-busting, (d) SW idle-termination behavior, (e) isolated vs MAIN world routing.

This phase has zero feature deliverable beyond the smoke. Its product is **certainty about the engine** for Phases 2-6.

---

## Codebase Reality

The repository today contains **only `.planning/`, `.git/`, `.claude/`** plus root-level config (no `package.json`, no `node_modules/`, no source). Phase 1 creates 100% of the codebase. Concrete state confirmed via `ls`:

```
gsd-test/
├── .claude/                   # IDE / agent config
├── .git/
└── .planning/
    ├── PROJECT.md
    ├── REQUIREMENTS.md
    ├── ROADMAP.md
    ├── STATE.md
    ├── config.json            # gsd workflow config
    ├── phases/01-foundation-spike-engine-skeleton/
    │   ├── 01-CONTEXT.md
    │   └── 01-DISCUSSION-LOG.md
    └── research/
        ├── ARCHITECTURE.md
        ├── FEATURES.md
        ├── PITFALLS.md
        ├── STACK.md
        └── SUMMARY.md
```

**Implications:**
- No reusable code, no established patterns. Every contract Phase 1 sets becomes the standard for Phases 2-6.
- No `package.json`, no `pnpm-workspace.yaml`, no `tsconfig.json` — the very first wave is "make this a Node monorepo" before WXT can even initialize.
- `./CLAUDE.md` does **not** exist. No project-specific overrides apply.
- `.planning/config.json` confirms: `commit_docs: true` (commit RESEARCH.md / spike doc), `nyquist_validation: true` (Validation Architecture section required), `branching_strategy: "none"` (work on main).
- Auto-memory established: Andrew owns product/UX, Claude owns stack and implementation. Don't surface technical questions to him.

---

## Implementation Approach

Strict ordering — each step depends on the previous. Skipping ahead causes rework.

### Step 1 — Repo Scaffolding (no extension code yet)

Goal: be a working pnpm monorepo before any extension code lands.

1. `pnpm init` at root → set `"private": true`, `"packageManager": "pnpm@10.x"`.
2. Write `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - apps/*
     - packages/*
   ```
3. Write root `tsconfig.base.json` with strict TS settings (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"target": "ES2022"`, `"moduleResolution": "bundler"`).
4. Write `.gitignore` covering `node_modules/`, `apps/extension/.output/`, `apps/extension/.wxt/`, `dist/`, `*.log`.
5. Initialize Biome at root: `pnpm dlx @biomejs/biome init` → `biome.json`. Enable recommended rules. Configure `formatter.indentStyle: "space"`, `linter.rules.suspicious.noExplicitAny: "error"`.
6. Add lefthook: `pnpm add -D -w lefthook`, write `lefthook.yml` with `pre-commit` running `pnpm lint && pnpm typecheck && pnpm test --run` and `pnpm check-csp`.
7. Add GitHub Actions workflow `.github/workflows/ci.yml` running `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm check-csp && pnpm build`.

### Step 2 — `packages/experiment-sdk` (zero-runtime types)

Goal: contract that experiments and engine both import from one place. Splitting now is cheap; later is expensive (D-10).

1. `mkdir -p packages/experiment-sdk/src`.
2. `packages/experiment-sdk/package.json`:
   ```json
   {
     "name": "@platform/experiment-sdk",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "peerDependencies": { "zod": "^4.0.0" }
   }
   ```
3. `packages/experiment-sdk/src/index.ts` — exports `ApplyArgs`, `ApplyFn`, `CleanupFn`, `Helpers` (Phase 1 minimal: `{log}`), `ExperimentManifest` (Zod schema + inferred TS type).
4. Per D-10: zero runtime code. Pure types + the Zod schema (Zod is a runtime dep, but the schema itself is reused at build time and validated again at boundaries).

### Step 3 — `apps/extension` (WXT scaffold)

Goal: WXT project that builds and loads. Bare popup + content + background entrypoints.

1. `cd apps && pnpm create wxt@latest extension --template react-ts` (or run `pnpm dlx wxt@latest init extension --template react-ts` from root).
2. Verify scaffold structure matches WXT 0.20 conventions: `apps/extension/entrypoints/popup/`, `entrypoints/content.ts`, `entrypoints/background.ts`, `wxt.config.ts`, `package.json`. **Spike question:** if WXT's default differs from CONTEXT D-09's `apps/extension/src/{background,content,popup}/main.ts`, document the actual layout in the spike doc and adopt WXT's convention (don't fight the framework).
3. Add Tailwind v4 + `@tailwindcss/vite` + shadcn/ui: `pnpm add -D tailwindcss @tailwindcss/vite` then `pnpm dlx shadcn@latest init` (Phase 1: only adds the bootstrap; no components yet).
4. Add direct deps: `pnpm add zod @platform/experiment-sdk` (workspace link).
5. Add dev deps: `pnpm add -D @types/chrome vitest @vitest/ui`.
6. `wxt.config.ts` declares two `content_scripts` entries — one `world: 'ISOLATED'`, one `world: 'MAIN'` — both with the same `matches: ["*://*.ya.ru/*", "*://ya.ru/*"]`. Each loads its own JS entry (`content-isolated.ts` / `content-main.ts`). Both also declared in WXT's `entrypoints/` so HMR picks them up. **[ASSUMED — spike to verify]:** WXT `defineContentScript({ world: 'MAIN' })` is the supported syntax in 0.20.x; if not, fall back to manual `manifest.content_scripts` patching via `wxt.config.ts` `manifest` hook.

### Step 4 — Engine Skeleton

Goal: minimum viable engine that picks up experiments via `import.meta.glob`, filters by world, calls `apply()`, tracks cleanup.

1. `apps/extension/src/shared/messages.ts` — typed message union (Phase 1 minimal): `{type:'EXPERIMENT_TOGGLE', id, enabled}`, `{type:'STATE_CHANGED'}`. Use `chrome.runtime.sendMessage` directly (no `@webext-core/messaging` yet — that's Phase 2 polish; one-off messages don't need it).
2. `apps/extension/src/shared/storage.ts` — thin typed wrapper over `chrome.storage.local`: `getEnabledExperiments(): Promise<Record<id, boolean>>`, `setEnabledExperiment(id, enabled): Promise<void>`. ZERO module-scope state.
3. `apps/extension/entrypoints/background.ts` — top-level (NOT inside `onInstalled`!) `chrome.runtime.onMessage.addListener(...)` handles `EXPERIMENT_TOGGLE`: writes storage, broadcasts `STATE_CHANGED` to all tabs matching any registered scope. Per Pitfall 1: top-level listeners are what wakes the SW.
4. `apps/extension/entrypoints/content-isolated.ts`:
   - At module top: `const registry = import.meta.glob('/experiments/*/*/manifest.json', { eager: true });` and `const modules = import.meta.glob('/experiments/*/*/experiment.ts');` (NOT eager — chunk per experiment, lazy-load).
   - Filter registry to manifests with `world === 'isolated'`.
   - On load + on `STATE_CHANGED`: query `getEnabledExperiments()`, for each matching enabled experiment whose `scope.match` matches `location.href`, call `apply()`, record cleanup in `Map<id, CleanupFn>`. Wrap in try/catch (D-14).
   - `chrome.runtime.onMessage.addListener` for `STATE_CHANGED` re-evaluates.
5. `apps/extension/entrypoints/content-main.ts` — symmetric; filter for `world === 'main'`. In Phase 1 this is empty/no-op (smoke is `world: isolated`), but the entrypoint MUST exist to prove ENG-03 routing actually works.
6. URL match — Phase 1 ships a minimal Chrome match-pattern matcher in `apps/extension/src/shared/url-match.ts` (regex fallback → Phase 3). Implement just enough: scheme + host wildcards + path glob. Vitest unit test required.

### Step 5 — Build-Time Experiment Discovery + Validation

Goal: Vite plugin that reads manifests, runs Zod, generates ULIDs, emits chunks per experiment.

1. `tools/build-experiments.ts` — Vite plugin. Hooks: `buildStart` (scan + validate), `resolveId` / `load` if needed for re-emission.
2. Scan: `glob('experiments/*/*/manifest.json')` from project root.
3. For each manifest:
   - Parse JSON.
   - If `id` missing/empty: generate ULID via `ulid` package, write back to file (preserve indentation), `console.log("Wrote new id …")`.
   - `ExperimentManifest.safeParse()`. On failure: collect `result.error.issues` and `throw new Error(formatted)`. Format: `\nManifest validation failed: experiments/andrew/smoke/manifest.json\n  - scope.match: array must contain at least 1 element\n  - world: expected 'isolated' | 'main', got 'iso'`.
   - Verify `manifest.author === <author segment from path>`. Mismatch = build fail.
4. Phase 1 stops here — no `dist/registry.json` (Phase 2). Engine reads via `import.meta.glob` at content-script-bundle time; Vite/Rollup statically analyzes.
5. WXT integration: register the plugin in `wxt.config.ts` via `vite.plugins`.

### Step 6 — Smoke Experiment

Per D-28 verbatim. After write, run `pnpm build` once — expect ULID generation, manifest re-write commit needed.

```jsonc
// experiments/andrew/smoke/manifest.json
{
  "id": "",
  "name": "Smoke pink",
  "author": "andrew",
  "description": "Turns ya.ru pink to verify foundation",
  "scope": { "match": ["*://*.ya.ru/*", "*://ya.ru/*"] },
  "world": "isolated",
  "tweaks": []
}
```

```ts
// experiments/andrew/smoke/experiment.ts
import type { ApplyFn } from '@platform/experiment-sdk';

export const apply: ApplyFn = ({ log }) => {
  const style = document.createElement('style');
  style.dataset.expId = 'smoke';
  style.textContent = 'body { background: pink !important; }';
  document.head.append(style);
  log('smoke applied');
  return () => {
    style.remove();
    log('smoke cleaned up');
  };
};
```

### Step 7 — Bare Popup

Per D-29: minimal toggle, no shadcn cards.

1. `apps/extension/entrypoints/popup/App.tsx` — fetches list via `import.meta.glob('/experiments/*/*/manifest.json', {eager: true})`, renders one `<input type="checkbox">` per manifest with name label.
2. Toggle handler sends `EXPERIMENT_TOGGLE` to SW; reads `getEnabledExperiments()` for initial state.
3. Tailwind base styles imported (`apps/extension/src/styles/popup.css` → `@tailwind base; @tailwind components; @tailwind utilities;` — Tailwind v4 syntax: `@import "tailwindcss";`).

### Step 8 — CSP Lint Script

`scripts/check-csp.ts` (in repo root, runs via `pnpm tsx`):

```ts
import { globSync } from 'glob';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'eval()', re: /\beval\s*\(/ },
  { name: 'new Function()', re: /\bnew\s+Function\s*\(/ },
  { name: 'remote import()', re: /import\s*\(\s*['"]https?:\/\//i },
];

const files = globSync(['apps/**/*.{ts,tsx,js,jsx}', 'experiments/**/*.{ts,js}'], {
  ignore: ['**/node_modules/**', '**/.output/**', '**/.wxt/**'],
});

let violations = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        console.error(`${file}:${i + 1}: forbidden ${name}: ${line.trim()}`);
        violations++;
      }
    }
  });
}
process.exit(violations > 0 ? 1 : 0);
```

Wired to `package.json` script `"check-csp": "tsx scripts/check-csp.ts"`.

### Step 9 — Spike Experiments + Document

For each of the 5 sections in `docs/spike/MV3-FOUNDATION.md`, run a minimal experiment in the loaded extension, observe, write findings:

1. **WXT vs CRXJS reconciliation** — read current WXT docs for content-script HMR mechanism; record: does WXT use CRXJS internally? If not, what does it use? Does the API match ARCHITECTURE.md's CRXJS-flavored examples?
2. **Content-script HMR** — edit `experiments/andrew/smoke/experiment.ts`, change pink → orange. Save. Measure: does the running tab update? In how many seconds? Does it require tab reload? Does it require extension reload?
3. **Dynamic import cache-busting** — at runtime, dynamically `import('/experiments/andrew/smoke/experiment.ts?v=' + Date.now())` (or whatever the actual chunk URL becomes). Confirm fresh content. Phase 5 hot-reload depends on this working.
4. **SW idle termination** — use `chrome://serviceworker-internals` "stop" button. Send `EXPERIMENT_TOGGLE` after the stop. Confirm SW wakes, processes, replies. Measure: time-to-wake. Document what happens to a `fetch` initiated 1s before the stop (does it complete? abort?).
5. **Two-world routing** — temporarily add `experiments/andrew/main-smoke/` with `world: 'main'` that does `(window as any).__SMOKE_MAIN__ = true`. From a page console (MAIN world), confirm the global is set. From the same tab, confirm isolated content-script CANNOT see it. Verify NO leakage between worlds. Remove the test experiment after recording findings (Phase 1 ships only the isolated smoke).

### Step 10 — Validation & Documentation

1. Run `pnpm test` (Vitest) — manifest schema unit tests pass, URL-matcher unit tests pass.
2. Run `pnpm typecheck` — no errors.
3. Run `pnpm check-csp` — exits 0.
4. Run `pnpm build` — produces `apps/extension/.output/chrome-mv3/`.
5. Manual: load unpacked, navigate to `https://ya.ru/`, toggle smoke ON in popup → page is pink. Toggle OFF → page reverts. Stop SW via `chrome://serviceworker-internals` → toggle again → still works.
6. Commit `docs/spike/MV3-FOUNDATION.md` with all 5 sections filled in.

---

## Key Files to Create / Modify

> All paths are absolute from repo root. "Modify" never appears in Phase 1 — everything is created from scratch.

### Repo Scaffolding
- `package.json` — root, `"private": true`, scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `check-csp`), workspaces config delegated to pnpm
- `pnpm-workspace.yaml` — `packages: [apps/*, packages/*]`
- `tsconfig.base.json` — strict TS settings, shared by all workspaces
- `tsconfig.json` — root, references `apps/extension`, `packages/experiment-sdk`
- `.gitignore` — `node_modules`, `.output`, `.wxt`, `dist`, `*.log`
- `biome.json` — Biome config (lint + format rules)
- `lefthook.yml` — pre-commit hook (lint, typecheck, test, check-csp)
- `.github/workflows/ci.yml` — install, lint, typecheck, test, check-csp, build on push/PR

### Extension SDK Package
- `packages/experiment-sdk/package.json` — name `@platform/experiment-sdk`, type `module`, exports `./src/index.ts`
- `packages/experiment-sdk/src/index.ts` — `ApplyArgs`, `ApplyFn`, `CleanupFn`, `Helpers` (minimal `{log}`), `ExperimentManifest` Zod schema + inferred type, `Tweak` placeholder type
- `packages/experiment-sdk/tsconfig.json` — extends base

### Extension App
- `apps/extension/package.json` — WXT scaffold + deps
- `apps/extension/wxt.config.ts` — declares two content_scripts entries (isolated + main), registers `tools/build-experiments.ts` Vite plugin, Tailwind plugin
- `apps/extension/entrypoints/background.ts` — top-level message listener; toggle handler; storage writes; broadcast to tabs
- `apps/extension/entrypoints/content-isolated.ts` — engine for isolated-world experiments; `import.meta.glob` registry; URL match; apply/cleanup orchestration
- `apps/extension/entrypoints/content-main.ts` — symmetric for MAIN-world; empty registry in Phase 1 but proves ENG-03 routing
- `apps/extension/entrypoints/popup/index.html` — WXT default
- `apps/extension/entrypoints/popup/App.tsx` — list of manifests + toggle per row
- `apps/extension/entrypoints/popup/main.tsx` — React mount
- `apps/extension/src/shared/storage.ts` — typed `chrome.storage.local` wrapper
- `apps/extension/src/shared/messages.ts` — typed message union (Phase 1 minimal)
- `apps/extension/src/shared/url-match.ts` — Chrome match-pattern matcher
- `apps/extension/src/shared/url-match.test.ts` — Vitest tests
- `apps/extension/src/styles/popup.css` — `@import "tailwindcss";`
- `apps/extension/tsconfig.json` — extends base, includes WXT-generated types

### Build Tools
- `tools/build-experiments.ts` — Vite plugin: scan, ULID-generate, Zod-validate, author-vs-folder check
- `tools/build-experiments.test.ts` — Vitest tests for plugin logic (validation error formatting, ULID idempotency)

### Smoke Experiment (D-28)
- `experiments/andrew/smoke/manifest.json` — ULID-empty initially, populated on first build
- `experiments/andrew/smoke/experiment.ts` — pink CSS, returns cleanup

### CI / Linting
- `scripts/check-csp.ts` — regex CSP check across `apps/**` + `experiments/**`
- `scripts/check-csp.test.ts` — Vitest tests (positive/negative cases for each regex)

### Spike Output
- `docs/spike/MV3-FOUNDATION.md` — 5-section verified-vs-broken document

**Total file count estimate:** ~30 new files. Phase 1 produces zero "feature" code — everything serves either the engine contract or the CI guardrails.

---

## External APIs / Libraries

All versions verified live against npm registry on **2026-04-25** with `npm view <pkg> version`. **Use these exact versions for the lockfile** — do not regress to STACK.md best-guesses.

### Pinned Versions (verified live)

| Package | Pin | Latest (2026-04-25) | Purpose |
|---------|-----|---------------------|---------|
| `wxt` | `^0.20.25` | 0.20.25 | MV3 framework: file-based entrypoints, manifest gen, Vite under the hood |
| `vite` | (transitive via WXT) | 8.0.10 | Bundler. **Note:** STACK.md guessed Vite 6.x — actual is 8.x. Don't pin separately. |
| `react` | `^19.2.5` | 19.2.5 | UI for popup |
| `react-dom` | `^19.2.5` | 19.2.5 | React renderer |
| `typescript` | `^6.0.3` | 6.0.3 | **Note:** STACK.md guessed 5.6+ — actual stable is 6.0. Update CONTEXT D-02 mention. |
| `zod` | `^4.3.6` | 4.3.6 | **Note:** STACK.md and CONTEXT D-03 said `~3.23+`. Latest is 4.x with breaking-change migration; verify schema syntax against Zod 4 docs. Likely affects `z.array().min(1)` (still supported), `z.enum().default()` (still supported). [ASSUMED — confirm Zod 4 API parity for D-16 schema before locking] |
| `tailwindcss` | `^4.2.4` | 4.2.4 | CSS engine. Use `@tailwindcss/vite` plugin (NOT PostCSS) per Tailwind v4. |
| `@tailwindcss/vite` | `^4.2.4` | 4.2.4 | Tailwind v4 Vite integration |
| `shadcn` | `^4.5.0` | 4.5.0 | CLI for component scaffolding (Phase 1: just init, no components added) |
| `zustand` | `^5.0.12` | 5.0.12 | (Phase 2 — not installed in Phase 1) |
| `@biomejs/biome` | `^2.4.13` | 2.4.13 | Lint + format |
| `vitest` | `^4.1.5` | 4.1.5 | Unit tests. **Note:** STACK.md guessed `~5.x` for Zustand which is correct; Vitest is 4.x. |
| `@types/chrome` | `^0.1.40` | 0.1.40 | Chrome MV3 API types |
| `clsx` | `^2.1.1` | 2.1.1 | Auto-installed by shadcn |
| `tailwind-merge` | `^3.5.0` | 3.5.0 | Auto-installed by shadcn |
| `lucide-react` | `^1.11.0` | 1.11.0 | Icons (auto via shadcn). Note: jumped from 0.577 → 1.0.0 on 2026-03-20. |
| `lefthook` | `^2.1.6` | 2.1.6 | Pre-commit hook manager |
| `ulid` | `^3.0.2` | 3.0.2 | Build-time ULID generation |
| `pnpm` | `^10.33.2` | 10.33.2 | Package manager |
| `node` | `>=24.0.0` | 24.15.0 | Engines field |

**Not installed in Phase 1:** `@webext-core/messaging`, `@webext-core/storage`, `react-markdown`, `openai`, `@anthropic-ai/sdk`, `@playwright/test`. These belong to Phase 2/4.

### Chrome Extension APIs Used (Phase 1)

| API | Phase 1 Usage | Notes |
|-----|---------------|-------|
| `chrome.runtime.onMessage` | Top-level listener in background.ts | MUST be top-level for SW wake-up (Pitfall 1) |
| `chrome.runtime.sendMessage` | Popup → SW for `EXPERIMENT_TOGGLE` | Promise-returning in MV3, no polyfill |
| `chrome.tabs.sendMessage` | SW → content scripts for `STATE_CHANGED` broadcast | Iterate `chrome.tabs.query({})`, suppress errors for tabs without content scripts |
| `chrome.tabs.query` | SW finds tabs to broadcast to | |
| `chrome.storage.local.get` / `.set` | All persistent state (enabled experiments, last errors) | Survives SW termination |
| `chrome.runtime.getURL` | Resolve experiment chunk URLs if needed for spike | Mostly handled by Vite/WXT bundling |

### WXT APIs Used

| API | Phase 1 Usage | Reference |
|-----|---------------|-----------|
| `defineConfig` (in `wxt.config.ts`) | Project config | `wxt.dev/api/config` [CITED] |
| `defineContentScript({ world })` | Two content scripts, one isolated + one MAIN | **[ASSUMED]** — `world` option in 0.20.x is the spike's first verification |
| `defineBackground` | Background SW entry | |
| WXT manifest hook (`config.manifest`) | Fallback for declaring world if `defineContentScript` doesn't expose it | |
| WXT auto-imports (optional) | Disabled in Phase 1 to keep imports explicit | |

### Zod 4 Schema (Phase 1 manifest)

```ts
import { z } from 'zod';

export const ExperimentManifest = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),  // ULID Crockford base32
  name: z.string().min(1),
  author: z.string().min(1),
  description: z.string().min(1).max(280),
  scope: z.object({
    match: z.array(z.string()).min(1),
    regex: z.array(z.string()).optional(),
  }),
  world: z.enum(['isolated', 'main']).default('isolated'),
  tweaks: z.array(z.unknown()).default([]),
});

export type ExperimentManifest = z.infer<typeof ExperimentManifest>;
```

[ASSUMED — Zod 4 API parity] — `z.enum().default()`, `z.array().min(1)`, `z.string().regex()` all still exist in Zod 4. Verify by reading Zod 4 changelog before lockfile commit.

---

## Validation Architecture

> Required because `workflow.nyquist_validation = true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `apps/extension/vitest.config.ts` (extends WXT-provided config) + root-level `vitest.workspace.ts` aggregating all workspaces |
| Quick run command | `pnpm test --run` (workspace-aware, runs all packages) |
| Full suite command | `pnpm test --run && pnpm typecheck && pnpm lint && pnpm check-csp && pnpm build` |
| Manual smoke | `pnpm build` → load unpacked → ya.ru → toggle → observe pink |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ENG-01 | Extension builds and loads via "load unpacked" | manual smoke + build smoke | `pnpm build && test -f apps/extension/.output/chrome-mv3/manifest.json` | ❌ Wave 0 (CI script) |
| ENG-02 | SW survives termination — no in-memory state | manual smoke (chrome://serviceworker-internals stop + toggle) | manual checklist in spike doc | ❌ manual-only — automated SW lifecycle test requires Playwright, deferred to Phase 6 |
| ENG-02 | Storage writes persist across reloads | unit | `pnpm vitest run apps/extension/src/shared/storage.test.ts` | ❌ Wave 0 |
| ENG-03 | Engine routes by `world` field | unit (registry filter logic) | `pnpm vitest run apps/extension/src/content/world-routing.test.ts` | ❌ Wave 0 |
| ENG-03 | Two content_scripts blocks emitted in built manifest | build-output assertion | `pnpm vitest run tools/build-experiments.test.ts -t world-routing` | ❌ Wave 0 |
| ENG-05 | Single experiment error doesn't break others | unit (engine try/catch) | `pnpm vitest run apps/extension/src/content/error-isolation.test.ts` | ❌ Wave 0 |
| BLD-01 | Experiments discovered via `import.meta.glob` | build-output assertion | `pnpm vitest run tools/build-experiments.test.ts -t discovery` | ❌ Wave 0 |
| BLD-02 | Invalid manifest fails build with readable error | unit (Zod error formatter) | `pnpm vitest run tools/build-experiments.test.ts -t validation` | ❌ Wave 0 |
| BLD-05 | CI lint blocks `eval`, `new Function`, remote import | unit (regex coverage) + integration (script exits 1) | `pnpm vitest run scripts/check-csp.test.ts` | ❌ Wave 0 |
| MAN-01 | Manifest with all required fields parses; missing field fails | unit (Zod) | `pnpm vitest run packages/experiment-sdk/src/manifest.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --run --changed` (Vitest --changed flag picks up files affected by uncommitted changes)
- **Per wave merge:** `pnpm test --run && pnpm typecheck && pnpm check-csp`
- **Phase gate:** Full suite green + manual smoke checklist in `docs/spike/MV3-FOUNDATION.md` checked off before `/gsd-verify-work`

### Wave 0 Gaps

All test infrastructure must be created in Phase 1's first wave (none exists yet):

- [ ] `apps/extension/vitest.config.ts` — Vitest config aware of WXT path aliases
- [ ] `vitest.workspace.ts` (root) — workspace-aware test runner
- [ ] `apps/extension/src/shared/url-match.test.ts` — covers Chrome match-pattern matcher edge cases
- [ ] `apps/extension/src/shared/storage.test.ts` — covers typed storage adapter (mocked `chrome.storage`)
- [ ] `apps/extension/src/content/world-routing.test.ts` — covers registry filter by `world` field
- [ ] `apps/extension/src/content/error-isolation.test.ts` — covers try/catch wrapping (intentional throw, others continue)
- [ ] `tools/build-experiments.test.ts` — covers discovery, ULID generation idempotency, Zod error formatting, author-vs-folder check
- [ ] `packages/experiment-sdk/src/manifest.test.ts` — covers ExperimentManifest schema (valid + invalid cases)
- [ ] `scripts/check-csp.test.ts` — covers each regex (positive + negative cases)
- [ ] Test fixtures: `tests/fixtures/manifests/valid.json`, `tests/fixtures/manifests/missing-id.json`, `tests/fixtures/manifests/bad-world.json`, etc.
- [ ] Mock `chrome.*` API for unit tests: `apps/extension/src/test-setup/chrome-mock.ts` (use `@types/chrome` types + Vitest `vi.stubGlobal`)
- [ ] Framework install: `pnpm add -D -w vitest @vitest/ui` (root) — already in Step 1 of approach

---

## Risks & Open Questions

Items the planner must explicitly decide or defer. Listed in priority order.

### R1 — WXT 0.20 `world: 'MAIN'` content-script API [ASSUMED → spike resolves]

CONTEXT D-13 commits to declarative two-world routing via the plugin manifest. STACK.md and SUMMARY.md don't confirm WXT's `defineContentScript` exposes `world` directly in 0.20.x. If it doesn't, fallback is the `wxt.config.ts` `manifest` hook patching `content_scripts` array manually. **Spike question 5 covers this.** The plan must accept either path; mark the task action as "use `defineContentScript({world})` if available, else patch manifest manually" rather than locking to one syntax.

### R2 — Zod 4 vs Zod 3 in CONTEXT [VERIFIED → minor]

CONTEXT D-03 says `Zod ~3.23+`; latest npm is 4.3.6. Zod 4 has breaking changes from 3.x (some renamed APIs, `z.string().email()` → `z.email()` etc.). The Phase 1 schema (D-16) uses only `z.object`, `z.string`, `z.array`, `z.enum`, `.regex`, `.min`, `.max`, `.optional`, `.default` — all present in Zod 4. **Recommend pinning Zod 4.x and updating CONTEXT.md note.** Risk: Phase 4 LLM helper may want Zod features that differ between versions. Resolve before lockfile.

### R3 — `import.meta.glob` from a path OUTSIDE the WXT project root [VERIFIED HIGH-MEDIUM]

`experiments/` lives at repo root (D-11), not under `apps/extension/`. Vite's `import.meta.glob` works with project-relative paths only. Two options:

1. **WXT srcDir setting** — set `srcDir` to repo root or use Vite's `root` config to extend visibility. Risk: WXT may not support root-outside-package.
2. **Symlink or alias** — `apps/extension/experiments` → `../../experiments` symlink, or a Vite alias `'@experiments': resolve(__dirname, '../../experiments')` then `import.meta.glob('@experiments/*/*/manifest.json', ...)`.

**Recommended:** option 2 (Vite alias). Symlinks break on Windows for some designers. Confirm `import.meta.glob` accepts alias-prefixed paths in Vite 8 — it does as of Vite 4+ [CITED: vitejs.dev/guide/features#glob-import]. **The planner must include a "verify glob resolution" task in the discovery wave.**

### R4 — pre-commit hook manager: lefthook vs husky [Discretion D-23]

CONTEXT explicitly leaves this to me. Recommendation: **lefthook**. Single binary, parallelizable, no Node bootstrap needed at commit time, faster than husky for monorepo. Already verified at npm: `lefthook@2.1.6`.

### R5 — TypeScript 6 in CONTEXT [VERIFIED → use TS 6]

CONTEXT D-02 says TS 5.6+; latest is 6.0.3. TS 6 dropped some deprecated `experimentalDecorators`, may require `verbatimModuleSyntax` updates. Low risk — Phase 1 has zero decorators or fancy module syntax. **Use TS 6.**

### R6 — Smoke "ya.ru" content matching [VERIFIED]

D-28 specifies `*://*.ya.ru/*` and `*://ya.ru/*`. Chrome match-patterns: `*://*.ya.ru/*` matches subdomains like `mail.ya.ru` but NOT `ya.ru` itself; `*://ya.ru/*` is needed for the apex. Correct in CONTEXT. The url-match unit test must cover both.

### R7 — Service worker top-level listener vs WXT-generated wrappers [HIGH risk] [ASSUMED]

WXT's `defineBackground({ main() { ... } })` typically calls `main()` once per SW startup. **CRITICAL question:** does WXT register listeners INSIDE `main()`, or at module top-level? Per Pitfall 1, listeners must be top-level (registered before any await) or the SW won't wake on the next event after termination. **Spike must verify** — read WXT source if needed. If WXT wraps in a way that breaks this, the plan must add a workaround (register `chrome.runtime.onMessage` outside `main()` body).

### R8 — Phase 1 includes `tweaks: []` validation in Zod but Phase 3 introduces full discriminated union [Resolved]

D-16 keeps tweaks as `z.array(z.unknown()).default([])` in Phase 1. Phase 3 will replace with discriminated union. The schema MUST be exported from `experiment-sdk` and the Phase 3 update will be a single edit there. No risk.

### R9 — How does the engine receive `STATE_CHANGED` when a tab is opened AFTER toggle? [Resolved]

Tabs opened later run their content-script entry point freshly; on init they `getEnabledExperiments()` from storage and self-evaluate. SW broadcast covers already-open tabs. Both paths must be implemented.

### R10 — Spike doc as a test artifact [Process risk]

Success criterion #2 requires `docs/spike/MV3-FOUNDATION.md` to be committed with verified-vs-broken findings. The plan must include a task whose acceptance is "all 5 sections answered, no TBDs." The verifier (`/gsd-verify-work`) should grep the doc for "TBD" or "TODO" as a gate.

---

## Recommended Plan Breakdown

Suggested wave structure for `01-PLAN.md`. Each wave is a logically independent unit with a clear merge gate. Total estimate: 5 waves, sequential, NO parallelization between waves (each depends on the previous).

### Wave 0 — Repo & Test Infrastructure (≈ 5 tasks)

**Goal:** Repo is a working pnpm monorepo with Biome, Vitest, lefthook, and CI scaffolded. NO extension code.

- T0.1: Root scaffolding — `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- T0.2: Biome init + config (`biome.json`)
- T0.3: Vitest workspace config + first dummy test that passes
- T0.4: lefthook install + `lefthook.yml` (pre-commit running lint/typecheck/test/check-csp)
- T0.5: GitHub Actions CI workflow (`.github/workflows/ci.yml`)

**Merge gate:** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test --run` all pass on CI.

### Wave 1 — Engine SDK + Manifest Schema (≈ 4 tasks)

**Goal:** `@platform/experiment-sdk` published as workspace package. Zod schema + types ready.

- T1.1: `packages/experiment-sdk/` scaffold (package.json, tsconfig.json)
- T1.2: `src/index.ts` — `ApplyArgs`, `ApplyFn`, `CleanupFn`, `Helpers`, `ExperimentManifest` Zod schema + inferred type
- T1.3: `src/manifest.test.ts` — comprehensive valid + invalid case coverage
- T1.4: Smoke import — empty `apps/extension/` placeholder imports `@platform/experiment-sdk` to prove workspace linking works

**Merge gate:** SDK package buildable and consumable. Tests cover ULID regex, missing fields, world enum, tweaks default.

### Wave 2 — WXT Scaffold + Engine Skeleton (≈ 6 tasks)

**Goal:** Loadable extension with two content_scripts (isolated + main), bare popup, top-level SW listener. Engine reads `import.meta.glob` registry, no experiments yet.

- T2.1: `pnpm dlx wxt@latest init apps/extension --template react-ts` + Tailwind v4 + `shadcn init`
- T2.2: `wxt.config.ts` — declare two content_scripts with `world: ISOLATED` and `world: MAIN`, register Tailwind plugin
- T2.3: `entrypoints/background.ts` — top-level message listener (CRITICAL pattern), handle `EXPERIMENT_TOGGLE`, broadcast `STATE_CHANGED`
- T2.4: `entrypoints/content-isolated.ts` — `import.meta.glob` registry, world-filter, URL match, apply/cleanup orchestration with try/catch (D-14)
- T2.5: `entrypoints/content-main.ts` — symmetric for MAIN-world (empty registry but proves routing)
- T2.6: `entrypoints/popup/App.tsx` — bare list with one toggle per manifest (D-29)

**Merge gate:** `pnpm build` succeeds; load unpacked works; popup renders empty list (no experiments yet).

### Wave 3 — Build-Time Discovery + Smoke Experiment (≈ 4 tasks)

**Goal:** Vite plugin discovers experiments, validates with Zod, generates ULIDs. Smoke experiment turns ya.ru pink.

- T3.1: `tools/build-experiments.ts` — Vite plugin: scan, ULID-generate, Zod-validate, author-vs-folder check
- T3.2: `tools/build-experiments.test.ts` — covers discovery, ULID idempotency, Zod error formatting, author mismatch
- T3.3: `experiments/andrew/smoke/manifest.json` + `experiment.ts` (D-28); first build auto-generates ULID
- T3.4: `apps/extension/src/shared/url-match.ts` + `.test.ts` — Chrome match-pattern matcher with both `*://ya.ru/*` and `*://*.ya.ru/*` cases

**Merge gate:** Manual smoke — load extension, navigate to ya.ru, toggle smoke ON → page is pink, toggle OFF → page reverts.

### Wave 4 — CI Guardrails (≈ 3 tasks)

**Goal:** CSP regex check active in pre-commit and CI.

- T4.1: `scripts/check-csp.ts` — three regex patterns, recursive scan, exit code 1 on violation
- T4.2: `scripts/check-csp.test.ts` — positive + negative cases per regex (eval, new Function, remote import); also test that legitimate uses like `// not eval()` in comments don't false-positive (or accept that comments are lint failures and fix authors' code)
- T4.3: Wire `pnpm check-csp` into `lefthook.yml` pre-commit and `.github/workflows/ci.yml`

**Merge gate:** Demonstrate via deliberate `eval('1+1')` insertion that pre-commit blocks; remove insertion. Demonstrate same in CI on a throwaway branch.

### Wave 5 — Spike & Documentation (≈ 5 tasks)

**Goal:** `docs/spike/MV3-FOUNDATION.md` committed with all 5 sections answered. Falsifiable manual smoke checklist in the doc proves all 5 success criteria.

- T5.1: WXT vs CRXJS reconciliation — read current WXT docs, confirm HMR mechanism, write findings
- T5.2: Content-script HMR — empirical test (edit experiment, measure reload behavior), write findings
- T5.3: Dynamic import cache-busting — test query-string cache-bust, write findings (informs Phase 5 hot-reload)
- T5.4: SW idle termination — `chrome://serviceworker-internals` "stop", measure wake time, observe in-flight fetch behavior, write findings
- T5.5: Two-world routing — temporary `experiments/andrew/_main-test/` validates MAIN world isolation, then removed; write findings

**Merge gate:** All 5 sections of `docs/spike/MV3-FOUNDATION.md` answered (no TBDs); SW restart smoke checklist passes; final `pnpm build` + `pnpm test` + `pnpm check-csp` clean.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WXT 0.20.x's `defineContentScript` supports `world: 'MAIN'` directly | External APIs / Step 3 | Fallback: patch `content_scripts` via `wxt.config.ts` `manifest` hook. Adds 1 task, no architectural impact. |
| A2 | Zod 4 schema syntax in D-16 (z.object, z.array.min, z.enum.default) is identical to Zod 3 | External APIs | Some renames possible. Resolve by reading Zod 4 changelog before Wave 1. Low impact — schema is small. |
| A3 | WXT's `defineBackground({ main() })` allows top-level listener registration outside `main()` | Risks R7 | If WXT wraps listeners only inside `main()`, the SW won't wake. Workaround: register listeners at module top before WXT's wrapping. Phase 1 spike MUST verify. |
| A4 | `import.meta.glob` works with Vite alias paths pointing outside the package root | Risks R3 | Symlink fallback or moving `experiments/` inside `apps/extension/` (violates D-11). Resolve in Wave 2 discovery. |
| A5 | SW idle nominal ~30s in Chrome 133+ | CONTEXT D-12 / Step 9 | Spike measures actual value; doesn't block plan, just records reality. |
| A6 | `import.meta.glob({eager: false})` produces one chunk per experiment (BLD-04 deferred is fine because Vite already does this by default) | Step 4 | If chunks coalesce, Phase 2's BLD-04 work changes shape. Low risk — Vite's default is one chunk per dynamic import target. |
| A7 | Yandex Browser smoke testing is deferred to Phase 6 (DIST-03), so Phase 1 Chrome stable validation is sufficient | Step 9.4 | Confirmed by ROADMAP — no risk. |
| A8 | `lucide-react@1.11.0` (versus `0.5xx` historical) is real and not a registry artifact | External APIs | Verified — npm shows the 1.0.0 release on 2026-03-20. Real major version bump. |

The Assumptions Log focuses the planner: A1, A3, A4 are early-wave verifications; A2 is a pre-lockfile check; A5/A6/A7/A8 are documentation-only.

---

## Open Questions

These are decisions the **plan-checker / executor** may face but the planner cannot fully resolve from research alone. Surface them in the plan; defer or punt with explicit reasoning.

1. **Where do top-level SW listeners live in a WXT project?**
   - What we know: WXT's `defineBackground({ main() })` is the documented entry. Pitfall 1 demands top-level listeners.
   - What's unclear: whether WXT's wrapping preserves top-level semantics or moves listeners inside `main()`.
   - Recommendation: Wave 2 task T2.3 includes a sub-step "verify SW listener registration order via `chrome://serviceworker-internals` cold-start log; document in spike doc."

2. **Should Phase 1 ship a `pnpm dev` watch mode at all?**
   - What we know: WXT's `wxt` command provides dev mode. Phase 5 owns hot-reload polish.
   - What's unclear: Whether enabling `pnpm dev` in Phase 1 risks introducing dev-only state that Phase 5 has to undo.
   - Recommendation: ship `pnpm dev` as it comes from WXT default — but document in spike doc that any HMR observed is "reference behavior for Phase 5 to formalize."

3. **Does the popup show experiments not matching the current tab?**
   - What we know: D-29 says "bare-bones list with one toggle". UI-05 (URL-filtered list) is Phase 3.
   - What's unclear: Whether bare = "show all manifests" or "show all manifests but disabled if no current-tab match."
   - Recommendation: Show ALL manifests, no URL filter (matches D-29 "bare"). Phase 3 adds filter.

4. **What error message does the user see in popup if smoke `apply()` throws?**
   - What we know: D-14 says console + `chrome.storage.local.last_errors[id]`. Phase 2 (UI-08) renders errors in popup.
   - What's unclear: Whether Phase 1 popup reads `last_errors` and renders any UI for it.
   - Recommendation: Phase 1 popup does NOT render errors. Storage is written by engine; Phase 2 popup consumes. Keeps Phase 1 truly minimal.

5. **Is the smoke experiment expected to revert if user navigates away from ya.ru?**
   - What we know: ENG-07 (SPA pushState handling) is Phase 5. Phase 1 has no SPA handling.
   - What's unclear: If user enables smoke on ya.ru, then navigates to google.com via address bar, does smoke "leak"?
   - Recommendation: Hard navigation (address bar) reloads the content script — natural reset. Same-tab SPA nav (pushState) wouldn't trigger reset, but ya.ru is mostly server-rendered SERPs and Phase 1 success criterion is just "pink on enable, revert on disable" — not "pink only on ya.ru."  Document in spike doc that SPA-leak is a Phase 5 concern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, dev server, tests | ✓ (assumed via standard dev box) | >=24.0.0 required | None — installer must check |
| pnpm | Workspace + lockfile | ✓ (assumed) | >=10.x | Install via corepack: `corepack enable pnpm` |
| Chrome stable | Manual smoke (ENG-01, ENG-02, success criterion 1, 5) | ✓ (assumed dev box) | 133+ | None — smoke requires Chrome |
| Git | Source control, lefthook hooks | ✓ | any | None |
| npm registry access | `pnpm install` | ✓ | — | None |
| Internet for `npm view` and Zod 4 docs | Pre-lockfile verification | ✓ | — | None |

**Missing dependencies with no fallback:**
- None identified. Project is greenfield with standard Node/Chrome dev box.

**Missing dependencies with fallback:**
- None — pnpm is the only "specialty" tool and corepack ships with Node 24.

**Not required in Phase 1 (deferred):**
- Yandex Browser (Phase 6 / DIST-03)
- Playwright runtime (Phase 6 E2E)
- OpenAI / Anthropic API keys (Phase 4)

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — full technology choices, rationale, alternatives
- `.planning/research/ARCHITECTURE.md` — component model, build order, anti-patterns
- `.planning/research/PITFALLS.md` — 25 ranked pitfalls (Pitfalls 1, 2, 3, 5 directly addressed in Phase 1)
- `.planning/research/SUMMARY.md` — synthesized executive summary, gaps, phase implications
- `.planning/phases/01-foundation-spike-engine-skeleton/01-CONTEXT.md` — locked decisions D-01..D-29
- `.planning/PROJECT.md` — vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — full 63-requirement catalog with traceability

### Secondary (live-verified during this session)
- `npm view` output for all 20 packages above — versions verified 2026-04-25, locked into Stack table
- WXT documentation — `wxt.dev` (referenced by STACK.md; not re-fetched in this session — reading fresh during Wave 2 is required)
- Chrome MV3 documentation — `developer.chrome.com/docs/extensions/mv3` (referenced by all upstream research; spike consults during Wave 5)

### Tertiary (LOW confidence — spike resolves)
- WXT `defineContentScript({world: 'MAIN'})` exact signature in 0.20.x — confirm in Wave 2
- Zod 4 vs Zod 3 schema-API parity — confirm before Wave 1 lockfile
- WXT background SW listener registration semantics — confirm in Wave 2 / spike Wave 5
- `import.meta.glob` with cross-package alias resolution in Vite 8 — confirm in Wave 2

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all 20 versions verified live against npm registry; architecture choices (WXT, React 19, Tailwind 4, Zod, Vitest, Biome, pnpm) confirmed by upstream research files
- Architecture: **HIGH** — Phase 1 reproduces canonical MV3 patterns documented in ARCHITECTURE.md; two-world routing, stateless SW, error isolation are all standard
- Pitfalls: **HIGH** — directly maps to PITFALLS.md Pitfalls 1, 2, 3, 5, 8 (the four "Critical" items addressable in Phase 1)
- WXT specifics: **MEDIUM** — version pinned, but `defineContentScript({world})` and SW listener registration semantics are spike-verified, not docs-verified in this session
- Spike outcomes: **LOW by design** — empirical findings ARE the spike's deliverable; cannot be predicted

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — stack is stable; if Phase 1 execution slips past this, re-run `npm view` for any package whose minor version moved)

## RESEARCH COMPLETE
