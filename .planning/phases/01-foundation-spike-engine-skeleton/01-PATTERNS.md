# Phase 1: Foundation Spike & Engine Skeleton — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 30 (all new — greenfield repo)
**Analogs found:** 0 in-repo / 30 (expected — no source code exists yet); 30 mapped to external conventions

---

## Greenfield Disclaimer

The repository on 2026-04-25 contains only `.planning/`, `.git/`, `.claude/`. There is **no `package.json`, no `apps/`, no `packages/`, no `src/`**. Therefore every file in this phase is created from scratch and there are zero in-repo analogs.

In place of "closest existing file in this codebase," each new file is mapped to:
1. **The convention being followed** (e.g. "WXT default scaffold", "Vite plugin author guide", "Biome `init` output", "shadcn/ui CLI output").
2. **The canonical reference** (URL or upstream file).
3. **The verbatim code shape** already present in CONTEXT.md (D-NN) and/or RESEARCH.md, which the planner can inline into `<read_first>` blocks and tasks without re-deriving.

This is not a gap — it is the correct answer for a greenfield repo. Subsequent phases (2-6) will use Phase 1's outputs as in-repo analogs.

---

## File Classification

| New File | Role | Data Flow | Convention Followed | Canonical Reference | Code Shape Source |
|----------|------|-----------|--------------------|---------------------|-------------------|
| `package.json` (root) | config | n/a | pnpm workspace root | `pnpm.io/workspaces` | RESEARCH Step 1.1 + "Pinned Versions" table |
| `pnpm-workspace.yaml` | config | n/a | pnpm workspaces | `pnpm.io/pnpm-workspace_yaml` | RESEARCH Step 1.2 (verbatim) |
| `tsconfig.base.json` | config | n/a | TS strict project base | `typescriptlang.org/tsconfig` | RESEARCH Step 1.3 (settings list) |
| `tsconfig.json` (root) | config | n/a | TS project references | `typescriptlang.org/docs/handbook/project-references.html` | RESEARCH "Key Files" §Repo Scaffolding |
| `.gitignore` | config | n/a | Node + WXT defaults | WXT `init` output | RESEARCH Step 1.4 (entries enumerated) |
| `biome.json` | config | n/a | `biome init` output | `biomejs.dev/reference/configuration` | RESEARCH Step 1.5 (overrides listed) |
| `lefthook.yml` | config | n/a | lefthook upstream example | `github.com/evilmartians/lefthook#configuration` | RESEARCH Step 1.6 (commands listed) |
| `.github/workflows/ci.yml` | config | event-driven (CI) | GitHub Actions Node template | `docs.github.com/actions` + pnpm action | RESEARCH Step 1.7 (commands listed) |
| `packages/experiment-sdk/package.json` | config | n/a | pnpm workspace package | `pnpm.io/workspaces` | RESEARCH Step 2.2 (verbatim JSON) |
| `packages/experiment-sdk/tsconfig.json` | config | n/a | TS project ref extending base | TS docs | "extends `../../tsconfig.base.json`" |
| `packages/experiment-sdk/src/index.ts` | sdk-types | request-response (contract) | Zero-runtime types + Zod schema | Zod 4 docs `zod.dev` | CONTEXT D-15, D-16; RESEARCH "Zod 4 Schema" block (verbatim) |
| `packages/experiment-sdk/src/manifest.test.ts` | test | n/a | Vitest unit | `vitest.dev/guide` | RESEARCH "Wave 0 Gaps" + Wave 1 T1.3 |
| `apps/extension/package.json` | config | n/a | WXT scaffold + workspace deps | WXT `init` output | RESEARCH Step 3.1, Step 3.4-3.5 (deps) |
| `apps/extension/tsconfig.json` | config | n/a | WXT-generated TS config | WXT `init` output | "extends base, includes `.wxt/types`" |
| `apps/extension/wxt.config.ts` | config | n/a | WXT `defineConfig` | `wxt.dev/api/config` | CONTEXT D-13; RESEARCH Step 3.6, R1, R3 |
| `apps/extension/entrypoints/background.ts` | service-worker | event-driven (pub-sub) | WXT `defineBackground` | `wxt.dev/guide/essentials/entrypoints/background` | CONTEXT D-12; PITFALLS Pitfall 1; RESEARCH Step 4.3, R7 |
| `apps/extension/entrypoints/content-isolated.ts` | content-script (engine) | event-driven (registry + pub-sub) | WXT `defineContentScript` (isolated world) | `wxt.dev/guide/essentials/entrypoints/content-scripts` | CONTEXT D-13, D-14, D-15; RESEARCH Step 4.4 |
| `apps/extension/entrypoints/content-main.ts` | content-script (engine) | event-driven (registry) | WXT `defineContentScript({world: 'MAIN'})` | `wxt.dev` + Chrome MV3 `world: MAIN` docs | CONTEXT D-13; RESEARCH Step 4.5, R1 |
| `apps/extension/entrypoints/popup/index.html` | view | n/a | WXT popup default | WXT `init` output | "WXT default" |
| `apps/extension/entrypoints/popup/main.tsx` | view | request-response | React 19 mount | React docs `react.dev/reference/react-dom/client/createRoot` | RESEARCH Step 7 + "Key Files" §Extension App |
| `apps/extension/entrypoints/popup/App.tsx` | view | request-response (msg → SW) | React 19 functional component | React docs | CONTEXT D-29; RESEARCH Step 7.1-7.3 |
| `apps/extension/src/shared/storage.ts` | adapter | CRUD (over chrome.storage.local) | Typed `chrome.storage.local` wrapper | `developer.chrome.com/docs/extensions/reference/api/storage` | CONTEXT D-12; RESEARCH Step 4.2 |
| `apps/extension/src/shared/storage.test.ts` | test | n/a | Vitest unit + mocked `chrome.*` | `vitest.dev/api/vi.html#vi-stubglobal` | RESEARCH "Wave 0 Gaps" |
| `apps/extension/src/shared/messages.ts` | type | request-response | Typed message-union | TS discriminated union pattern | CONTEXT D-15; RESEARCH Step 4.1 |
| `apps/extension/src/shared/url-match.ts` | utility | transform (string → boolean) | Chrome match-pattern matcher | `developer.chrome.com/docs/extensions/develop/concepts/match-patterns` | RESEARCH Step 4.6, R6 |
| `apps/extension/src/shared/url-match.test.ts` | test | n/a | Vitest unit | `vitest.dev` | RESEARCH "Wave 0 Gaps" |
| `apps/extension/src/styles/popup.css` | asset | n/a | Tailwind v4 `@import` | `tailwindcss.com/docs/installation/using-vite` | RESEARCH Step 7.3 (`@import "tailwindcss";`) |
| `apps/extension/vitest.config.ts` | config | n/a | Vitest config | `vitest.dev/config` | RESEARCH "Validation Architecture" |
| `apps/extension/src/content/world-routing.test.ts` | test | n/a | Vitest unit | `vitest.dev` | RESEARCH "Wave 0 Gaps" |
| `apps/extension/src/content/error-isolation.test.ts` | test | n/a | Vitest unit | `vitest.dev` | RESEARCH "Wave 0 Gaps" |
| `apps/extension/src/test-setup/chrome-mock.ts` | test-utility | n/a | `vi.stubGlobal` for `chrome.*` | Vitest docs + `@types/chrome` | RESEARCH "Wave 0 Gaps" |
| `vitest.workspace.ts` (root) | config | n/a | Vitest workspace | `vitest.dev/guide/workspace` | RESEARCH "Validation Architecture" |
| `tools/build-experiments.ts` | build-plugin | batch (file I/O + transform) | Vite plugin author guide | `vitejs.dev/guide/api-plugin.html` | CONTEXT D-20, D-21, D-17, D-18; RESEARCH Step 5.1-5.4 |
| `tools/build-experiments.test.ts` | test | n/a | Vitest unit | `vitest.dev` | RESEARCH "Wave 0 Gaps" |
| `experiments/andrew/smoke/manifest.json` | data | n/a | Project-defined `ExperimentManifest` | this repo's Zod schema (D-16) | CONTEXT D-28 (verbatim) |
| `experiments/andrew/smoke/experiment.ts` | experiment-module | event-driven (apply/cleanup) | Project-defined `ApplyFn` contract | this repo's `experiment-sdk` (D-15) | CONTEXT D-28 (verbatim) |
| `scripts/check-csp.ts` | utility | batch (file I/O + grep) | Standard Node + glob script | `glob` package readme + `node:fs` docs | RESEARCH Step 8 (verbatim TS source) |
| `scripts/check-csp.test.ts` | test | n/a | Vitest unit | `vitest.dev` | RESEARCH "Wave 0 Gaps" |
| `docs/spike/MV3-FOUNDATION.md` | doc | n/a | Project-defined spike report | CONTEXT D-26 outline (5 sections) | CONTEXT D-26, D-27; RESEARCH Step 9 |

**Match-quality summary:**
- Files with in-repo exact analog: 0
- Files with in-repo role-match analog: 0
- Files mapped to external convention with concrete excerpt in CONTEXT/RESEARCH: 30
- Files mapped to external convention without excerpt (planner consults upstream docs at write time): 9 (`.gitignore`, `biome.json`, `tsconfig.base.json`, `tsconfig.json`, `apps/extension/tsconfig.json`, popup `index.html`, popup `main.tsx`, both root configs `vitest.workspace.ts` / `apps/extension/vitest.config.ts`)

---

## Pattern Assignments

Each section names the convention, the canonical reference, and quotes the verbatim code shape from CONTEXT.md or RESEARCH.md so the planner can inline it into a `<read_first>` block.

### Group A — Repo Scaffolding (Wave 0)

#### `package.json` (root), `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `.gitignore`

**Convention:** pnpm workspaces + TS project references — vanilla shape.

**Canonical references:**
- `pnpm.io/workspaces`
- `typescriptlang.org/docs/handbook/project-references.html`

**Code shape (RESEARCH Step 1):**

`pnpm-workspace.yaml` (verbatim, RESEARCH §Implementation Approach Step 1.2):
```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.base.json` settings (RESEARCH Step 1.3):
- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"target": "ES2022"`
- `"moduleResolution": "bundler"`

`.gitignore` entries (RESEARCH Step 1.4):
```
node_modules/
apps/extension/.output/
apps/extension/.wxt/
dist/
*.log
```

`package.json` root scripts (RESEARCH §Key Files):
- `dev`, `build`, `lint`, `typecheck`, `test`, `check-csp`
- `"private": true`
- `"packageManager": "pnpm@10.x"` (use exact pin from RESEARCH Pinned Versions: `pnpm@10.33.2`)
- `"engines": { "node": ">=24.0.0" }`

**No analog needed** — these are standard config files; copy from upstream pnpm/TS docs verbatim.

---

#### `biome.json`

**Convention:** `pnpm dlx @biomejs/biome init` output, with the overrides listed in RESEARCH.

**Canonical reference:** `biomejs.dev/reference/configuration`

**Required overrides (RESEARCH Step 1.5 verbatim):**
- Recommended rules enabled.
- `formatter.indentStyle: "space"`
- `linter.rules.suspicious.noExplicitAny: "error"`

**Pin (RESEARCH "Pinned Versions"):** `@biomejs/biome ^2.4.13`.

---

#### `lefthook.yml`

**Convention:** lefthook upstream example, single `pre-commit` group running monorepo-wide commands.

**Canonical reference:** `github.com/evilmartians/lefthook#configuration` (file: `lefthook.yml`)

**Code shape (RESEARCH Step 1.6 verbatim):**
- pre-commit runs: `pnpm lint && pnpm typecheck && pnpm test --run && pnpm check-csp`

**Pin:** `lefthook ^2.1.6`.

---

#### `.github/workflows/ci.yml`

**Convention:** GitHub Actions standard Node + pnpm template (`pnpm/action-setup`).

**Canonical reference:** `github.com/pnpm/action-setup`

**Code shape (RESEARCH Step 1.7 verbatim):**
- Runs on push + PR.
- Steps: checkout → setup-node 24 → pnpm/action-setup → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test --run` → `pnpm check-csp` → `pnpm build`.

---

### Group B — `experiment-sdk` Package (Wave 1)

#### `packages/experiment-sdk/package.json`

**Convention:** pnpm workspace internal package with `"private": true`, `type: "module"`, source-only `exports`.

**Code shape (RESEARCH Step 2.2 — VERBATIM):**
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

Planner: copy this block into the task's `<action>` verbatim.

---

#### `packages/experiment-sdk/src/index.ts`

**Role:** sdk-types (request-response contract).

**Convention:** Zero-runtime TypeScript types + a single Zod schema. No business logic.

**Canonical reference:** Zod 4 docs at `zod.dev`.

**Code shapes — both VERBATIM from CONTEXT and RESEARCH:**

**`ApplyArgs` / `ApplyFn` / `CleanupFn`** (CONTEXT D-15 verbatim):
```ts
type ApplyArgs = {
  tweaks: Record<string, unknown>;   // {} in Phase 1
  helpers: Helpers;                   // { log } only in Phase 1
  currentURL: string;
  log: (msg: string, ...args: unknown[]) => void;
  signal: AbortSignal;
};
type ApplyFn = (args: ApplyArgs) => CleanupFn | Promise<CleanupFn>;
type CleanupFn = () => void | Promise<void>;
```

**`ExperimentManifest` schema** (CONTEXT D-16 + RESEARCH "Zod 4 Schema" — verbatim):
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

**Helpers (Phase 1 minimal):** export `type Helpers = { log: (msg: string, ...args: unknown[]) => void }`.

**Tweak placeholder:** export `type Tweak = unknown` so Phase 3 can replace it without breaking imports.

**Planner action:** put both CONTEXT D-15 and the schema block above directly into the `<read_first>` of the SDK task.

---

#### `packages/experiment-sdk/src/manifest.test.ts`

**Convention:** Vitest unit tests covering valid + invalid manifest cases.

**Cases to cover (RESEARCH "Wave 0 Gaps" + Wave 1 T1.3):**
- Valid manifest parses and `safeParse().success === true`.
- Missing `id` fails.
- ULID regex: `01J0ABCDEFGHJKMNPQRSTVWXYZ` accepted; `not-a-ulid` rejected; lowercase rejected; characters `I`/`L`/`O`/`U` rejected.
- `world: 'iso'` rejected; `world` defaulted to `'isolated'` when omitted.
- `scope.match: []` rejected (`.min(1)`).
- `description` >280 chars rejected.
- `tweaks` defaults to `[]`.

---

### Group C — Extension Application (Wave 2)

#### `apps/extension/package.json`

**Convention:** WXT React-TS scaffold output, augmented with workspace + Tailwind + Zod + Vitest deps.

**Canonical reference:** `wxt.dev/guide/installation` (`wxt init --template react-ts`).

**Required deps (RESEARCH Step 3, "Pinned Versions"):**
- prod: `wxt ^0.20.25`, `react ^19.2.5`, `react-dom ^19.2.5`, `zod ^4.3.6`, `@platform/experiment-sdk` (workspace:*), `clsx ^2.1.1`, `tailwind-merge ^3.5.0`, `lucide-react ^1.11.0`
- dev: `typescript ^6.0.3`, `@types/chrome ^0.1.40`, `@types/react`, `@types/react-dom`, `tailwindcss ^4.2.4`, `@tailwindcss/vite ^4.2.4`, `vitest ^4.1.5`, `@vitest/ui`, `ulid ^3.0.2` (used by `tools/build-experiments.ts` — root or app, planner picks)

---

#### `apps/extension/wxt.config.ts`

**Convention:** WXT `defineConfig` + Tailwind Vite plugin + custom Vite plugin registration.

**Canonical reference:** `wxt.dev/api/config`.

**Required structure (CONTEXT D-13 + RESEARCH Step 3.6, R1, R3):**
1. Import `defineConfig` from `wxt`.
2. Import `tailwindcss` from `@tailwindcss/vite`.
3. Import `buildExperiments` from `../../tools/build-experiments` (or via workspace alias).
4. `vite: () => ({ plugins: [tailwindcss(), buildExperiments()], resolve: { alias: { '@experiments': '<repo-root>/experiments' } } })`.
5. Two content_scripts entries — handled either via `defineContentScript({ world: 'ISOLATED' | 'MAIN' })` files OR via a `manifest` hook that patches `content_scripts` array directly.
   - **R1 fallback rule (RESEARCH):** "use `defineContentScript({world})` if available in WXT 0.20.x, else patch manifest manually." Document the chosen path in the spike doc.
6. `matches` for both content scripts: `["*://*.ya.ru/*", "*://ya.ru/*"]`.

**Open assumption (RESEARCH A1, R1):** `world` field availability in `defineContentScript` is spike-verified. Planner must include a sub-task to verify before locking syntax.

---

#### `apps/extension/entrypoints/background.ts`

**Convention:** WXT `defineBackground({ main() })`, but **with `chrome.runtime.onMessage` registered at module top-level (NOT inside `main()`).** This is non-negotiable per Pitfall 1.

**Canonical reference:** `wxt.dev/guide/essentials/entrypoints/background` + Chrome MV3 SW lifecycle docs.

**Code shape (CONTEXT D-12, RESEARCH Step 4.3):**
```ts
// MUST be at module top-level so Chrome registers the listener before SW idle-termination
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'EXPERIMENT_TOGGLE') {
    handleToggle(msg.id, msg.enabled).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
});

export default defineBackground(() => {
  // Per WXT semantics: runs once per SW startup. Keep empty-or-near-empty.
  // No state, no listener registration here.
});
```

**Stateless rule (CONTEXT D-12):** No `let cache = …` at module scope. All state through `apps/extension/src/shared/storage.ts`.

**Broadcast on toggle:** after writing storage, iterate `chrome.tabs.query({})` and send `STATE_CHANGED` to each tab; suppress per-tab errors (tabs without content scripts will reject).

**Spike question (RESEARCH R7):** confirm WXT does not relocate top-level listeners into the `main()` body. If it does, the workaround is exactly the pattern above (declare outside `defineBackground`).

---

#### `apps/extension/entrypoints/content-isolated.ts`

**Convention:** WXT `defineContentScript({ world: 'ISOLATED', matches, main })`. The engine logic.

**Canonical reference:** `wxt.dev/guide/essentials/entrypoints/content-scripts` + Chrome `content_scripts` MV3 docs.

**Code shape (RESEARCH Step 4.4 — to be inlined verbatim in `<read_first>`):**
1. **Top-of-module registry** (statically analyzed by Vite):
   ```ts
   const manifests = import.meta.glob('@experiments/*/*/manifest.json', { eager: true });
   const modules   = import.meta.glob('@experiments/*/*/experiment.ts'); // NOT eager — chunk per experiment
   ```
   `import.meta.glob` is required by BLD-01 (MV3 CSP forbids runtime fetch); see RESEARCH §Risks R3 for alias path resolution.

2. **World filter:** keep only manifests whose `world === 'isolated'`.

3. **URL match:** `import { matchesUrl } from '../src/shared/url-match'`. For each enabled+matching manifest, dynamic-import its module, call `apply()`, store cleanup in `Map<id, CleanupFn>`.

4. **Error isolation pattern (CONTEXT D-14, RESEARCH Step 4.4):**
   ```ts
   for (const id of toApply) {
     try {
       const mod = await modules[modulePathFor(id)]();
       const cleanup = await mod.apply({
         tweaks: {},
         helpers: { log: (...a) => console.debug('[exp]', id, ...a) },
         currentURL: location.href,
         log: (...a) => console.debug('[exp]', id, ...a),
         signal: abortControllers.get(id)!.signal,
       });
       cleanups.set(id, cleanup);
     } catch (err) {
       console.error('[engine] apply failed', id, err);
       await chrome.storage.local.set({ [`last_error:${id}`]: String(err) });
       // CRITICAL: continue loop — one failure must NOT break others (ENG-05)
     }
   }
   ```
   `try/catch` MUST wrap each `apply()` and each `cleanup()` individually (Anti-Pattern: a single try/catch around the whole loop fails ENG-05).

5. **`STATE_CHANGED` listener:** `chrome.runtime.onMessage.addListener` re-runs the apply/cleanup diff on receipt.

6. **Initial load:** on script start, also call `getEnabledExperiments()` and apply matching ones (covers tabs opened after a previous toggle — RESEARCH R9).

---

#### `apps/extension/entrypoints/content-main.ts`

**Convention:** Symmetric to `content-isolated.ts` but `world: 'MAIN'`. **Same code shape**, only differing by:
- `defineContentScript({ world: 'MAIN', ... })`
- Filter is `world === 'main'`.
- Phase 1 registry resolves to empty (smoke is `isolated`), but the file MUST exist to prove ENG-03 routing actually emits two content_scripts blocks in the built `manifest.json`.

**Reference:** RESEARCH Step 4.5 + Chrome MV3 `world: MAIN` docs.

**Spike experiment (RESEARCH Step 9.5):** temporary `experiments/andrew/_main-test/` with `world: 'main'` validates routing, removed after recording findings.

---

#### `apps/extension/entrypoints/popup/App.tsx`, `main.tsx`, `index.html`

**Convention:** React 19 functional component, plain `<input type="checkbox">` toggles. **No shadcn components in Phase 1** (CONTEXT D-29; shadcn CLI is initialized but unused).

**Canonical references:**
- React docs `react.dev/reference/react-dom/client/createRoot`
- WXT popup template (default scaffold for `index.html` and the React mount).

**Code shape (RESEARCH Step 7):**
- `App.tsx` reads `import.meta.glob('@experiments/*/*/manifest.json', { eager: true })` for the list.
- For each manifest: render row with `name` label and a `<input type="checkbox">`.
- Toggle handler: `chrome.runtime.sendMessage({ type: 'EXPERIMENT_TOGGLE', id, enabled })`.
- Initial state: read `getEnabledExperiments()` once on mount.
- **Phase 1 popup does NOT render `last_errors`** (RESEARCH Open Question 4 → recommendation: defer to Phase 2).
- **Phase 1 popup shows ALL manifests, no URL filter** (RESEARCH Open Question 3 → recommendation: bare = show all).

---

#### `apps/extension/src/shared/storage.ts`

**Convention:** Thin typed wrapper over `chrome.storage.local`. Zero module-scope state.

**Canonical reference:** `developer.chrome.com/docs/extensions/reference/api/storage`.

**Code shape (RESEARCH Step 4.2):**
```ts
export async function getEnabledExperiments(): Promise<Record<string, boolean>> {
  const { enabled } = await chrome.storage.local.get('enabled');
  return (enabled ?? {}) as Record<string, boolean>;
}
export async function setEnabledExperiment(id: string, enabled: boolean): Promise<void> {
  const current = await getEnabledExperiments();
  await chrome.storage.local.set({ enabled: { ...current, [id]: enabled } });
}
```

**Rule:** every read returns from storage — never cache in module scope (CONTEXT D-12).

---

#### `apps/extension/src/shared/messages.ts`

**Convention:** TS discriminated-union message type. No `@webext-core/messaging` (deferred to Phase 2).

**Code shape (RESEARCH Step 4.1):**
```ts
export type ExtensionMessage =
  | { type: 'EXPERIMENT_TOGGLE'; id: string; enabled: boolean }
  | { type: 'STATE_CHANGED' };
```

---

#### `apps/extension/src/shared/url-match.ts`

**Convention:** Implementation of Chrome match-pattern spec (scheme + host wildcards + path glob).

**Canonical reference:** `developer.chrome.com/docs/extensions/develop/concepts/match-patterns`.

**Code shape (RESEARCH Step 4.6, R6):**
- `matchesUrl(url: string, patterns: string[]): boolean`.
- Both `*://ya.ru/*` and `*://*.ya.ru/*` are required to match `https://ya.ru/` and `https://mail.ya.ru/` respectively. R6 explicitly notes `*://*.ya.ru/*` does NOT match the apex `ya.ru`, so two patterns are needed.
- Phase 1 supports: scheme (`*`/`http`/`https`), host (`*` prefix wildcard), path (`*` wildcard).
- Regex fallback support → Phase 3 (MAN-02), do NOT implement here.

**Test cases (RESEARCH "Wave 0 Gaps" + R6):**
- `https://ya.ru/` matches `*://ya.ru/*` ✓
- `https://ya.ru/` matches `*://*.ya.ru/*` ✗ (subdomain pattern excludes apex)
- `https://mail.ya.ru/foo` matches `*://*.ya.ru/*` ✓
- `http://ya.ru/x` matches `*://ya.ru/*` ✓
- `https://example.com/` matches neither ✗

---

#### `apps/extension/src/styles/popup.css`

**Convention:** Tailwind v4 import.

**Canonical reference:** `tailwindcss.com/docs/installation/using-vite`.

**Verbatim content:**
```css
@import "tailwindcss";
```

(No `@tailwind base; @tailwind components; @tailwind utilities;` — that is v3 syntax. Phase 1 uses v4 single-import.)

---

### Group D — Vitest Wiring (Wave 0)

#### `vitest.workspace.ts` (root) and `apps/extension/vitest.config.ts`

**Convention:** Vitest workspace + per-package config aware of WXT path aliases.

**Canonical references:**
- `vitest.dev/guide/workspace`
- `vitest.dev/config`

**Notes (RESEARCH "Validation Architecture"):**
- Workspace aggregates `apps/*`, `packages/*`, `tools`, `scripts`, `tests`.
- `apps/extension/vitest.config.ts` extends WXT-provided test config (or stubs `chrome.*` via `setupFiles: ['src/test-setup/chrome-mock.ts']`).

---

#### `apps/extension/src/test-setup/chrome-mock.ts`

**Convention:** `vi.stubGlobal('chrome', { storage: { local: { get, set } }, runtime: { onMessage: { addListener: vi.fn() }, sendMessage: vi.fn() }, tabs: { query: vi.fn(), sendMessage: vi.fn() } })`.

**Canonical reference:** `vitest.dev/api/vi.html#vi-stubglobal` + `@types/chrome` for shape.

---

#### `apps/extension/src/content/world-routing.test.ts`

**Convention:** Pure-function unit test of the registry filter (`world === 'isolated'` / `'main'`).

**Cases (RESEARCH "Wave 0 Gaps"):**
- Manifest with `world: 'isolated'` is included by isolated filter, excluded by main filter.
- Manifest with `world: 'main'` is included by main filter, excluded by isolated filter.
- Manifest without `world` (defaulted via Zod `.default('isolated')`) lands in isolated.

---

#### `apps/extension/src/content/error-isolation.test.ts`

**Convention:** Vitest test that calls the engine apply-loop with two stub experiments — first throws, second succeeds — and asserts the second still ran and recorded cleanup.

**Cases (RESEARCH "Wave 0 Gaps", ENG-05):**
- First experiment's `apply()` throws → `console.error` called, `chrome.storage.local.set({ 'last_error:<id>': ... })` called.
- Second experiment's `apply()` still runs and its cleanup is registered.
- Symmetric test for `cleanup()` errors during disable.

---

### Group E — Build Plugin (Wave 3)

#### `tools/build-experiments.ts`

**Convention:** Vite plugin via the official author guide. Hooks: `buildStart` (scan + Zod), and an alias for `@experiments` resolution.

**Canonical reference:** `vitejs.dev/guide/api-plugin.html`.

**Required behaviors (CONTEXT D-17, D-18, D-20, D-21 + RESEARCH Step 5):**

1. **Discovery (D-20, BLD-01):** `glob('experiments/*/*/manifest.json')` from project root via the `glob` package (Node-side, not `import.meta.glob` which is Vite-runtime).

2. **ULID generation (D-17):** if `id` missing or empty, generate ULID via `ulid` package, write back preserving JSON formatting (use `JSON.stringify(parsed, null, 2)` and end with `\n`), `console.log("Wrote new id to <path> — please commit")`.

3. **Zod validation (D-21, BLD-02):** `ExperimentManifest.safeParse(parsed)`. On failure, format issues as:
   ```
   Manifest validation failed: experiments/andrew/smoke/manifest.json
     - scope.match: array must contain at least 1 element
     - world: expected 'isolated' | 'main', got 'iso'
   ```
   Then `throw new Error(formatted)` — Vite turns this into a build failure with the formatted message visible.

4. **Author-vs-folder check (D-18):** parse path → extract `<author>` segment → assert `parsed.author === <author>`. Mismatch fails the build with a clear message.

5. **No `dist/registry.json` emit** (RESEARCH §Step 5.4 + CONTEXT D-22) — that is BLD-03 in Phase 2.

**Test cases (`tools/build-experiments.test.ts`, RESEARCH "Wave 0 Gaps"):**
- Valid manifest → no errors.
- Missing `id` → ULID is written back; second run is idempotent (no second write).
- Invalid `world` → formatted Zod error matches expected snapshot.
- `manifest.author !== folder` → throws with author-mismatch message.
- Discovery picks up `experiments/<a>/<b>/manifest.json`, ignores `experiments/<a>/manifest.json` (depth must be 2).

---

### Group F — Smoke Experiment (Wave 3)

#### `experiments/andrew/smoke/manifest.json`

**Convention:** Project-defined `ExperimentManifest`. ULID empty on first commit, populated by build (D-17).

**Code (CONTEXT D-28 + RESEARCH Step 6 — VERBATIM):**
```jsonc
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

After first `pnpm build`: `id` becomes a 26-char ULID; commit the change. RESEARCH Step 6 calls this out explicitly.

---

#### `experiments/andrew/smoke/experiment.ts`

**Convention:** Project-defined `ApplyFn` from `@platform/experiment-sdk`. The first canonical example of an experiment module — every later experiment will copy this shape.

**Code (CONTEXT D-28 + RESEARCH Step 6 — VERBATIM):**
```ts
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

Phase 1 experiment does its own DOM work — no `injectStyle` helper (deferred to Phase 4).

---

### Group G — CSP Lint Script (Wave 4)

#### `scripts/check-csp.ts`

**Convention:** Plain Node + `glob` script invoked via `tsx` (or compiled).

**Canonical reference:** `glob` package readme + `node:fs` docs.

**Code (RESEARCH Step 8 — VERBATIM, copy directly into `<read_first>`):**
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

**Wired (RESEARCH Step 8):** `package.json` script `"check-csp": "tsx scripts/check-csp.ts"`. Called from `lefthook.yml` and `.github/workflows/ci.yml`.

**Test cases (`scripts/check-csp.test.ts`, RESEARCH "Wave 0 Gaps"):**
- Positive: file containing `eval('1+1')` exits 1 with correct file:line message.
- Positive: `new Function('return 1')` flagged.
- Positive: `import('https://example.com/x.js')` flagged.
- Negative: `// eval is bad` in a comment is currently flagged (regex-only, no AST). RESEARCH Step 8 explicitly accepts this trade-off — fix authors' code rather than complicate the linter.

---

### Group H — Spike Document (Wave 5)

#### `docs/spike/MV3-FOUNDATION.md`

**Convention:** Project-defined spike report. 5 sections, each with verified-vs-broken findings. **No analog needed** — outline is fully specified.

**Required sections (CONTEXT D-26 verbatim):**
1. WXT vs CRXJS reconciliation — what we use, why, which WXT primitives equate to ARCHITECTURE.md's CRXJS-flavored examples.
2. Content-script HMR — verified-vs-broken: re-apply works without full reload? what latency?
3. Dynamic import cache-busting — what URL/query versioning is needed for content scripts to pick up new chunks without extension reload (informs Phase 5 hot-reload).
4. SW idle termination — measured idle-to-kill time on current Chrome; what happens to in-flight `fetch` at kill.
5. Two-world routing — confirmed declarative approach works; isolated-only and main-only experiments both load.

**SW restart smoke checklist (CONTEXT D-27):** open `chrome://serviceworker-internals` → "stop" SW → toggle smoke in popup → apply/cleanup must work.

**Verifier gate (RESEARCH R10):** `/gsd-verify-work` greps the doc for `TBD` / `TODO` — none allowed.

---

## Shared Patterns

These cross-cutting patterns apply to multiple files; the planner should reference them from each affected task.

### SP-1: Stateless Service Worker

**Source:** CONTEXT D-12, PITFALLS Pitfall 1, RESEARCH Step 4.

**Apply to:** `entrypoints/background.ts`, `entrypoints/content-isolated.ts`, `entrypoints/content-main.ts`, `src/shared/storage.ts`.

**Rule:** No `let` / `const` declarations holding state at module scope. All persistent state through `chrome.storage.local` via the `storage.ts` adapter. `chrome.runtime.onMessage.addListener` is registered at module top-level (NOT inside `defineBackground({ main() })`). Verified by SW-stop smoke check.

---

### SP-2: Per-Call Error Isolation (ENG-05)

**Source:** CONTEXT D-14, RESEARCH Step 4.4 ("Anti-Pattern: a single try/catch around the whole loop").

**Apply to:** `entrypoints/content-isolated.ts`, `entrypoints/content-main.ts`.

**Rule:** every `apply()` and every `cleanup()` is wrapped in its OWN try/catch. Errors are logged to `console.error` AND written to `chrome.storage.local` as `last_error:<id>`. Loop continues after a caught error. Auto-disable after N errors → Phase 2 (out of scope here).

---

### SP-3: Static Discovery via `import.meta.glob` (BLD-01)

**Source:** CONTEXT D-20, RESEARCH §Risks R3, Chrome MV3 CSP rule "no remote scripts."

**Apply to:** `entrypoints/content-isolated.ts`, `entrypoints/content-main.ts`, `entrypoints/popup/App.tsx`.

**Rule:**
- Manifests: `import.meta.glob('@experiments/*/*/manifest.json', { eager: true })`.
- Modules: `import.meta.glob('@experiments/*/*/experiment.ts')` — NOT eager (chunk per experiment).
- Use the Vite alias `@experiments` (RESEARCH R3 recommendation) — not symlinks (Windows-hostile), not `srcDir` games.
- NO runtime `fetch()` of experiment files; NO dynamic `import()` of remote URLs (CSP-blocked + caught by check-csp).

---

### SP-4: Zod Manifest as Single Source of Truth (MAN-01)

**Source:** CONTEXT D-16, D-21.

**Apply to:** `packages/experiment-sdk/src/index.ts` (definition), `tools/build-experiments.ts` (build-time validation), and any Phase 2+ runtime boundary check.

**Rule:** the schema is exported once from `@platform/experiment-sdk`. Both the build plugin and runtime code import the same schema. Inferred TS type `ExperimentManifest` is also exported and used for typed access. Phase 3 will replace `tweaks: z.array(z.unknown())` with a discriminated union — single edit point (RESEARCH R8).

---

### SP-5: Chrome Match-Pattern Both Forms

**Source:** CONTEXT D-28, RESEARCH R6.

**Apply to:** `experiments/andrew/smoke/manifest.json`, any future experiment scoped to a domain apex.

**Rule:** to scope to both apex and subdomains, declare BOTH `*://<host>/*` and `*://*.<host>/*`. The url-match utility's tests must enforce this distinction.

---

### SP-6: Pinned Versions (No Best-Guess)

**Source:** RESEARCH "Pinned Versions" table (live-verified 2026-04-25).

**Apply to:** `package.json` (root), `apps/extension/package.json`, `packages/experiment-sdk/package.json`.

**Rule:** do not use the `~3.23+` / `~5.x` / `5.6+` ranges from STACK.md. Use the exact pins from RESEARCH (e.g. `wxt ^0.20.25`, `react ^19.2.5`, `typescript ^6.0.3`, `zod ^4.3.6`, `tailwindcss ^4.2.4`, `vitest ^4.1.5`, `@biomejs/biome ^2.4.13`, `lefthook ^2.1.6`, `ulid ^3.0.2`, `pnpm@10.33.2`). Re-run `npm view` only if Phase 1 execution slips beyond 2026-05-25 (RESEARCH "Valid until").

---

### SP-7: Top-Level Listener Registration (Pitfall 1)

**Source:** PITFALLS Pitfall 1, RESEARCH R7, A3.

**Apply to:** `entrypoints/background.ts`.

**Rule:** `chrome.runtime.onMessage.addListener` MUST be a top-level statement in the module (executed during SW startup, not inside `main()` or any async branch). If WXT's `defineBackground` wraps content into `main()` and removes top-level execution, register listeners outside `defineBackground` (the file can have both — top-level statements and a `defineBackground(() => {...})` default export).

**Verification:** spike Wave 5 task "Cold-start log via `chrome://serviceworker-internals` shows `onMessage` listener attached before any await."

---

## No Analog Found (in-repo)

ALL 30 files. Documented above with external-convention mappings. No file in this phase has an in-repo precursor.

For Phase 2+ planning, the files below become the in-repo analogs for future similar work:

| Phase 1 file | Becomes in-repo analog for |
|--------------|----------------------------|
| `entrypoints/content-isolated.ts` | Future engine extensions (Phase 2 URL-filtering, Phase 3 tweak round-trip, Phase 4 helpers, Phase 5 SPA nav) |
| `tools/build-experiments.ts` | Phase 2 BLD-03 (`dist/registry.json` emit), BLD-04 (per-experiment chunks), Phase 3 manifest schema upgrades |
| `packages/experiment-sdk/src/index.ts` | Phase 2-4 SDK extensions (`Helpers.injectStyle`, `Helpers.llm`, full `Tweak` union) |
| `experiments/andrew/smoke/` | Acceptance-experiment shape (Phase 6 designer onboarding) |
| `apps/extension/src/shared/storage.ts` | Phase 2 last-error reads, Phase 5 ordering state |
| `apps/extension/src/shared/url-match.ts` | Phase 3 regex fallback (MAN-02) |
| `scripts/check-csp.ts` | Future ad-hoc lint scripts (same Node + glob shape) |
| `apps/extension/src/test-setup/chrome-mock.ts` | All future content/SW unit tests |

---

## Metadata

**Pattern extraction date:** 2026-04-25
**Repo state at extraction:** greenfield — only `.planning/`, `.git/`, `.claude/` exist.
**Files scanned in repo:** 0 source files (none exist).
**Sources consulted:**
- `.planning/phases/01-foundation-spike-engine-skeleton/01-CONTEXT.md` (decisions D-01 through D-29)
- `.planning/phases/01-foundation-spike-engine-skeleton/01-RESEARCH.md` (Step 1-10, Key Files list, Pinned Versions, Risks R1-R10, Assumptions A1-A8, Open Questions 1-5, Validation Architecture)
- External canonical references named per file (URLs in the table above)

**Planner note:** every code block in this document is either VERBATIM from CONTEXT.md / RESEARCH.md (so the planner can paste it into `<read_first>` without paraphrasing) or a verbatim convention from upstream documentation (`@import "tailwindcss";`, `import { defineConfig } from 'wxt'`, etc.). Where an assumption needs spike verification (R1, R3, R7), the table of contents flags it explicitly.
