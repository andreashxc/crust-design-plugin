# Phase 2: State Foundation, Messaging & Popup Shell — Pattern Map

**Mapped:** 2026-04-25
**Files in scope:** 49 (modify: 16, create: 33)
**Analogs found:** 47 in-repo / 49 (the 2 with no precedent are new external library integrations: `@webext-core/messaging` and shadcn/ui CLI scaffolds, both fully specified verbatim by RESEARCH §3 and §4 respectively)

---

## Brownfield Disclaimer (replaces Phase 1's greenfield note)

Phase 1 is shipped, verified, and committed. Every Phase 2 file has a Phase 1 in-repo analog covering naming, alias usage, top-level listener placement, per-call try/catch, idempotent JSON shape, ULID-keyed storage, Vitest co-location, and chrome-mock setup. Pattern lock-in is real:

- `entrypoints/background.ts` defines the SP-7 top-level-listener contract for ALL Phase 2 SW handlers.
- `apps/extension/src/shared/storage.ts` defines the typed-helper-per-key shape for all new storage helpers (auto-disable, error-window, applied-in-tab, last-error map, migration).
- `apps/extension/src/content/engine.ts` + `entrypoints/content-isolated.content.ts` define the per-call try/catch + cleanup-Map shape that the new reconcile pipeline extends.
- `apps/extension/entrypoints/popup/{App,main}.tsx` define the React 19 mount + `loadManifests()` pattern; Phase 2 REPLACES `loadManifests()` with `fetch(getURL('registry.json'))` + Zustand-store hydration but preserves the `createRoot(root).render(<StrictMode><App/></StrictMode>)` mount shape.
- `tools/build-experiments.ts` defines the `Plugin` shape (`name` + `buildStart`); Phase 2 ADDS a sibling `generateBundle` hook (does not refactor `buildStart`).
- `apps/extension/src/test-setup/chrome-mock.ts` defines the `vi.stubGlobal('chrome', makeChromeMock())` + `_data` introspection shape. Phase 2 adds `onChanged`, `setAccessLevel`, and `runtime.getURL` to it without changing the discovery convention.
- `apps/extension/vitest.config.ts` defines the per-package config shape (`environment: 'node'` + `setupFiles`). Phase 2 flips the popup tests to `environment: 'jsdom'` (per-file via `// @vitest-environment jsdom` pragma OR by widening the global config — Claude's Discretion).
- `packages/experiment-sdk/src/index.ts` defines the zero-runtime + Zod schema convention; Phase 2 ADDS types and one ~5-line helper (`byId`).

**Only one true convention evolution exists in Phase 2:** `apps/extension/src/shared/messages.ts` REPLACES the Phase 1 hand-rolled tag-union + `isExtensionMessage` runtime guard with `defineExtensionMessaging<ProtocolMap>()` from `@webext-core/messaging` (CONTEXT D-04). This is a deliberate, locked decision (the Phase 1 file's doc-comment explicitly predicted it), not a violation of pattern lock-in. Everything else is purely additive.

---

## File Classification

| File (M=modify, C=create) | Role | Data Flow | Closest Phase 1 Analog | Match |
|---|---|---|---|---|
| **SDK package** | | | | |
| `packages/experiment-sdk/src/index.ts` (M) | sdk-types | request-response (contract) | self (Phase 1 same file) | exact |
| `packages/experiment-sdk/src/registry.test.ts` (C) | test (unit) | n/a | `packages/experiment-sdk/src/manifest.test.ts` | exact |
| `packages/experiment-sdk/src/manifest.test.ts` (M) | test (unit) | n/a | self (Phase 1 same file) | exact |
| **Storage** | | | | |
| `apps/extension/src/shared/storage.ts` (M) | adapter (typed wrapper) | CRUD over chrome.storage.{local,session} | self (Phase 1 same file) | exact |
| `apps/extension/src/shared/storage.test.ts` (M) | test (unit) | n/a | self (Phase 1 same file) | exact |
| **Messaging Bus** | | | | |
| `apps/extension/src/shared/messages.ts` (M) | type (protocol) | request-response | self (Phase 1) — REPLACED, not extended | role-match (intentional evolution per D-04) |
| `apps/extension/package.json` (M) | config | n/a | self (Phase 1 same file) | exact |
| `apps/extension/src/shared/messages.test.ts` (C) | test (compile-only) | n/a | `packages/experiment-sdk/src/manifest.test.ts` (compile-test idiom) | role-match |
| **SW Orchestrator** | | | | |
| `apps/extension/entrypoints/background.ts` (M) | service-worker entry | event-driven (pub-sub) | self (Phase 1 same file) | exact |
| `apps/extension/src/background/handlers/experiment-toggle.ts` (C) | handler (SW message) | request-response | inline `handleToggle()` in Phase 1 `background.ts:36-50` | exact |
| `apps/extension/src/background/handlers/experiment-error.ts` (C) | handler (SW message) | request-response (error report) | inline `handleToggle()` in Phase 1 `background.ts:36-50` | role-match |
| `apps/extension/src/background/broadcast.ts` (C) | utility (helper) | pub-sub | inline broadcast loop in Phase 1 `background.ts:39-49` | exact |
| `apps/extension/src/background/handlers/experiment-toggle.test.ts` (C) | test (unit) | n/a | `apps/extension/src/shared/storage.test.ts` (chrome-mock + helper-direct invocation) | exact |
| `apps/extension/src/background/handlers/experiment-error.test.ts` (C) | test (unit) | n/a | `apps/extension/src/content/error-isolation.test.ts` (helper-direct + storage assertion) | exact |
| **Engine + Content Scripts** | | | | |
| `apps/extension/src/content/engine.ts` (M) | engine (pure helpers) | transform + apply-loop | self (Phase 1 same file) | exact |
| `apps/extension/entrypoints/content-isolated.content.ts` (M) | content-script entry | event-driven (registry + pub-sub) | self (Phase 1 same file) | exact |
| `apps/extension/entrypoints/content-main.content.ts` (M) | content-script entry | event-driven | self (Phase 1 same file) | exact |
| `apps/extension/src/content/contract.test.ts` (C) | test (TS-only / `@ts-expect-error`) | n/a | no exact analog; idiom from `manifest.test.ts` (compile expectations) | role-match |
| `apps/extension/src/content/abort-signal.test.ts` (C) | test (unit) | n/a | `apps/extension/src/content/error-isolation.test.ts` | exact |
| `apps/extension/src/content/error-isolation.test.ts` (M) | test (unit) | n/a | self (Phase 1 same file) | exact |
| **Build Plugin** | | | | |
| `tools/build-experiments.ts` (M) | build-plugin (Vite) | batch (file I/O + transform) | self (Phase 1 same file) | exact |
| `apps/extension/wxt.config.ts` (M) | config | n/a | self (Phase 1 same file) | exact |
| `tools/build-experiments.test.ts` (M) | test (unit) | n/a | self (Phase 1 same file) | exact |
| **Popup Shell — shadcn scaffolding (CLI-generated)** | | | | |
| `apps/extension/components.json` (C) | config (shadcn) | n/a | none — first shadcn install | external (shadcn CLI output) |
| `apps/extension/src/lib/utils.ts` (C) | utility (`cn`) | n/a | none — generated by `shadcn init` | external (shadcn CLI output) |
| `apps/extension/src/components/ui/{switch,card,collapsible,badge,scroll-area,button}.tsx` (C) | component (shadcn primitive) | presentation | none — generated by `shadcn add <name>` | external (shadcn CLI output, copy-paste model — source lives in tree) |
| `apps/extension/src/styles/popup.css` (M) | stylesheet | n/a | self (Phase 1 same file) | exact (shadcn `init` augments) |
| **Popup Shell — authored** | | | | |
| `apps/extension/src/popup/store.ts` (C) | store (Zustand) | event-driven (subscribed to chrome.storage.onChanged) | none in tree; pattern verbatim in RESEARCH §8 | external (Zustand 5 slice idiom) |
| `apps/extension/src/popup/status.ts` (C) | utility (pure function) | transform | `apps/extension/src/shared/url-match.ts` (pure-function shape) | role-match |
| `apps/extension/src/popup/grouping.ts` (C) | utility (pure function) | transform | `apps/extension/src/shared/url-match.ts` (pure-function shape) | role-match |
| `apps/extension/entrypoints/popup/main.tsx` (M) | view (React mount + bootstrap) | event-driven (storage.onChanged) | self (Phase 1 same file) | exact (extends, does not replace mount) |
| `apps/extension/entrypoints/popup/App.tsx` (M) | view (top-level component) | request-response (sendMessage) | self (Phase 1) — REPLACED with shadcn shell, but `loadManifests()` removed and store-driven | role-match (full body rewrite per UI-SPEC) |
| `apps/extension/entrypoints/popup/components/AuthorGroup.tsx` (C) | component (presentation) | presentation | none in tree; pattern verbatim in UI-SPEC §"Component Inventory" | role-match (Collapsible idiom from shadcn docs) |
| `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` (C) | component (presentation) | presentation + request-response | the Phase 1 `<li>` row in `App.tsx:48-66` (now Card-wrapped) | role-match |
| `apps/extension/entrypoints/popup/App.test.tsx` (C) | test (jsdom, RTL) | n/a | none — first popup test (jsdom env is new in Phase 2) | external (RTL idiom + Phase 1 chrome-mock) |
| `apps/extension/src/popup/store.test.ts` (C) | test (unit) | n/a | `apps/extension/src/shared/storage.test.ts` (chrome-mock + assertion shape) | role-match |
| `apps/extension/src/popup/status.test.ts` (C) | test (unit, pure function) | n/a | (would be) `apps/extension/src/shared/url-match.test.ts` — Phase 1 file (pure-fn truth-table style) | role-match |
| `apps/extension/src/popup/grouping.test.ts` (C) | test (unit, pure function) | n/a | same as above | role-match |
| **Test Setup** | | | | |
| `apps/extension/src/test-setup/chrome-mock.ts` (M) | test-utility | n/a | self (Phase 1 same file) | exact (additive: onChanged, setAccessLevel, runtime.getURL) |
| `apps/extension/vitest.config.ts` (M) | config | n/a | self (Phase 1 same file) | exact (flip to `jsdom` for popup tests) |

**Match-quality summary:**
- Files with in-repo exact analog: 24
- Files with in-repo role-match analog: 16
- Files with no in-repo analog (external scaffold or first-of-its-kind): 9
  - shadcn CLI outputs (8 files): `components.json`, `src/lib/utils.ts`, six `src/components/ui/*.tsx`
  - Zustand store (1 file): `apps/extension/src/popup/store.ts` — pattern verbatim in RESEARCH §8

---

## Pattern Assignments

Each section names the Phase 1 in-repo analog (or, for new files, the external authoritative source) plus a 5-15 line excerpt the planner can drop into a `<read_first>` block verbatim.

---

### Group A — SDK Extensions

#### `packages/experiment-sdk/src/index.ts` (M)

**Analog:** self — Phase 1 already established the convention.

**Existing import + Zod-block + type-only-export pattern** (`packages/experiment-sdk/src/index.ts:1-43`, lines 1-43 verbatim):
```ts
import { z } from 'zod';

export const ExperimentManifest = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
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

export type Helpers = { log: (msg: string, ...args: unknown[]) => void };
export type Tweak = unknown;
```

**Phase 2 ADDS** (CONTEXT D-30, RESEARCH §1.5):
- Six new type-only exports: `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`. Same `export type` style as Phase 1's `Helpers`, `Tweak`, `ApplyArgs`, `CleanupFn`, `ApplyFn`.
- One ~5-line pure helper:
  ```ts
  export function byId(registry: Registry, id: string): RegistryEntry | undefined {
    return registry.find((e) => e.id === id);
  }
  ```

**Constraint (D-31):** SDK stays zero-runtime EXCEPT for the existing Zod schema and `byId`. No new dependencies; `byId` is pure.

---

#### `packages/experiment-sdk/src/registry.test.ts` (C)

**Analog:** `packages/experiment-sdk/src/manifest.test.ts:14-25` — Vitest unit + safeParse-style positive/negative cases.

**Excerpt to copy** (`manifest.test.ts:1-25`):
```ts
import { describe, expect, it } from 'vitest';
import { ExperimentManifest } from './index';

describe('ExperimentManifest schema (D-16)', () => {
  describe('valid input', () => {
    it('accepts the canonical valid fixture', () => {
      const result = ExperimentManifest.safeParse(loadFixture('valid.json'));
      expect(result.success).toBe(true);
    });
  });
});
```

**Phase 2 cases** (RESEARCH §12 row "MAN-04"):
- `byId(registry, '<known-id>')` returns the entry.
- `byId(registry, '<unknown-id>')` returns `undefined`.
- `byId([], 'anything')` returns `undefined`.

---

#### `packages/experiment-sdk/src/manifest.test.ts` (M)

**Analog:** self.

**Phase 2 ADDS** a compile-only assertion that the new types exist:
```ts
import type {
  AutoDisableRecord,
  ErrorRecord,
  ExperimentStatus,
  Registry,
  RegistryEntry,
} from './index';

// Type-level assertion: each import resolves to a non-`never` type.
const _statusOk: ExperimentStatus = 'applied';
```

---

### Group B — Storage

#### `apps/extension/src/shared/storage.ts` (M)

**Analog:** self — `apps/extension/src/shared/storage.ts:1-32`.

**Existing convention (verbatim, lines 1-23):**
```ts
const KEY_ENABLED = 'enabled';
const LAST_ERROR_PREFIX = 'last_error:';

export async function getEnabledExperiments(): Promise<Record<string, boolean>> {
  const result = await chrome.storage.local.get(KEY_ENABLED);
  const value = result[KEY_ENABLED];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, boolean>;
  }
  return {};
}

export async function setEnabledExperiment(id: string, enabled: boolean): Promise<void> {
  const current = await getEnabledExperiments();
  await chrome.storage.local.set({
    [KEY_ENABLED]: { ...current, [id]: enabled },
  });
}
```

**Pattern lock:**
- `KEY_*` / `*_PREFIX` constants at top of file (no string literals scattered through helpers).
- Every helper is `async`, types its return, defends against malformed values with a runtime guard (line 13).
- No module-scope state (D-12 / SP-1).
- Read → mutate → write back; no caching.

**Phase 2 ADDS** (RESEARCH §7 verbatim, CONTEXT D-29 idempotent migration):
- `KEY_AUTODISABLED = 'autodisabled'`, `KEY_LAST_ERROR = 'last_error'`, `ERR_WINDOW_PREFIX = 'error_window:'`, `APPLIED_PREFIX = 'applied:'`, `PHASE1_LAST_ERROR_PREFIX = 'last_error:'`.
- Helpers per RESEARCH §7: `getLastErrors`, `setLastError`, `clearLastError`, `getAutoDisabled`, `setAutoDisable`, `clearAutoDisable`, `getErrorWindow`, `setErrorWindow`, `clearErrorWindow`, `getAppliedInTab`, `setAppliedInTab`.
- `runStartupMigration()` — see RESEARCH §7 verbatim block (uses `_migrations: string[]` key; migration name `'last_error_to_map_v1'`; reads all `last_error:*` keys and consolidates).

**Phase 1 helpers stay** (`getEnabledExperiments`, `setEnabledExperiment`, `recordLastError`, `clearLastError`). The `recordLastError` helper now writes through `setLastError` instead of the per-key shape (or stays as a deprecated forwarder — Claude's Discretion). Migration ensures existing per-key data is preserved.

---

#### `apps/extension/src/shared/storage.test.ts` (M)

**Analog:** self — `apps/extension/src/shared/storage.test.ts:1-52`.

**Existing test idiom (verbatim, lines 1-26):**
```ts
import { describe, expect, it } from 'vitest';
import {
  clearLastError,
  getEnabledExperiments,
  recordLastError,
  setEnabledExperiment,
} from './storage';

describe('storage adapter (D-12 stateless)', () => {
  it('getEnabledExperiments returns {} when storage is empty', async () => {
    await expect(getEnabledExperiments()).resolves.toEqual({});
  });

  it('setEnabledExperiment persists a single id', async () => {
    await setEnabledExperiment('01J0ABCDEFGHJKMNPQRSTVWXYZ', true);
    await expect(getEnabledExperiments()).resolves.toEqual({
      '01J0ABCDEFGHJKMNPQRSTVWXYZ': true,
    });
  });
});
```

**Pattern lock:**
- Tests ALWAYS use the chrome-mock from `beforeEach` (re-stubbed per test, see `chrome-mock.ts:68-70`); never reach into `chrome.storage._data` directly to seed state — call the public helper.
- `expect(...).resolves.toEqual(...)` for async returns.
- `chrome.storage.local.get(null as unknown as string)` for "give me everything" (line 37 idiom) — keep using it for migration tests.

**Phase 2 ADDS:** RESEARCH §12 row "ENG-06" + "MAN-03" + D-29 idempotency:
- `getAutoDisabled` returns `{}` when empty; `setAutoDisable`+`clearAutoDisable` round-trip.
- `getErrorWindow` returns `undefined` when empty; `setErrorWindow`+`clearErrorWindow` round-trip — assert key shape `error_window:<ulid>` lands in `chrome.storage.session._data`.
- `getAppliedInTab` returns `[]` when empty; `setAppliedInTab(tabId, ['a','b'])` lands at `chrome.storage.session._data['applied:'+tabId]`.
- Migration idempotency: seed `last_error:X = 'old'` + `last_error:Y = 'old2'`, run `runStartupMigration()`, assert (a) `last_error` key is now a map `{X: {phase, message, at}, Y: {…}}`, (b) old per-key entries are gone, (c) `_migrations` array contains `'last_error_to_map_v1'`. Run a second time, assert nothing changed.

---

### Group C — Messaging Bus (the one true convention evolution)

#### `apps/extension/src/shared/messages.ts` (M)

**Analog:** self — `apps/extension/src/shared/messages.ts:1-15` (full file, Phase 1).

**Phase 1 shape (verbatim, will be REPLACED):**
```ts
export type ExtensionMessage =
  | { type: 'EXPERIMENT_TOGGLE'; id: string; enabled: boolean }
  | { type: 'STATE_CHANGED' };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return t === 'EXPERIMENT_TOGGLE' || t === 'STATE_CHANGED';
}
```

**Phase 2 shape** (RESEARCH §3 verbatim, CONTEXT D-04, D-05):
```ts
import type { ErrorRecord, ExperimentStatus } from '@platform/experiment-sdk';
import { defineExtensionMessaging } from '@webext-core/messaging';

export type ToggleResult = { ok: true } | { ok: false; error: string };
export type ErrorReport = {
  id: string;
  phase: 'apply' | 'cleanup';
  message: string;
  stack?: string;
};

export interface ProtocolMap {
  EXPERIMENT_TOGGLE(data: { id: string; enabled: boolean }): ToggleResult;
  STATE_CHANGED(data: { tabId: number }): void;   // payload enriched per RESEARCH R8 (Claude's Discretion refinement of D-05)
  EXPERIMENT_ERROR(data: ErrorReport): { ok: true };
  STATUS_QUERY(): Record<string, ExperimentStatus>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

**Why the change is allowed despite brownfield:** Phase 1's file already explicitly predicted this move in its doc-comment (`messages.ts:5: "Phase 2 will introduce richer messages via @webext-core/messaging"`). CONTEXT D-04 locks the migration. The `isExtensionMessage` runtime guard goes away — `@webext-core/messaging` handles tag decoding internally.

**Callers to update** (all replace `chrome.runtime.sendMessage({type, ...})` with `sendMessage('EVENT_NAME', data)`):
- `apps/extension/entrypoints/background.ts` — see Group D below.
- `apps/extension/entrypoints/content-isolated.content.ts` — see Group E below.
- `apps/extension/entrypoints/popup/App.tsx` — see Group H below.

---

#### `apps/extension/package.json` (M)

**Analog:** self — current state (`apps/extension/package.json:15-33`):
```json
"dependencies": {
  "@platform/experiment-sdk": "workspace:*",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "zod": "^4.3.6"
},
"devDependencies": {
  "@platform/build-tools": "workspace:*",
  "@tailwindcss/vite": "^4.2.4",
  "@types/chrome": "^0.1.40",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@wxt-dev/module-react": "^1.1.5",
  "tailwindcss": "^4.2.4",
  "typescript": "^6.0.3",
  "vitest": "^4.1.5",
  "wxt": "^0.20.25"
}
```

**Phase 2 ADDS (RESEARCH §14):**
- dependencies: `@webext-core/messaging` (verify version with `npm view @webext-core/messaging version` at install time), `zustand ^5.0.12`, plus the shadcn-init transitive deps captured at install time: `class-variance-authority`, `lucide-react`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@radix-ui/react-switch`, `@radix-ui/react-collapsible`, `@radix-ui/react-scroll-area` (slot if Button needs it).
- devDependencies: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

**Pattern lock (RESEARCH "Pinned Versions" / Phase 1 SP-6):** record the exact installed versions in package.json after `pnpm add` / `pnpm dlx shadcn add`; do not range-bump in the same PR. The version captures in Wave 0 / Wave 3 of execution.

---

#### `apps/extension/src/shared/messages.test.ts` (C)

**Analog:** none directly; idiom from `packages/experiment-sdk/src/manifest.test.ts:1-7` (compile-only style).

**Pattern:** type-only smoke test — assert `ProtocolMap` is well-formed and `sendMessage`/`onMessage` are typed correctly. Body is mostly TypeScript imports + `expectTypeOf` assertions, runtime body can be a single `it.skip` or `it('exports compile', () => {})`.

```ts
// Compile-only test: if this file fails typecheck, the protocol shape is broken.
import { describe, it, expectTypeOf } from 'vitest';
import { onMessage, sendMessage, type ProtocolMap } from './messages';

describe('ProtocolMap', () => {
  it('EXPERIMENT_TOGGLE has typed args + result', () => {
    expectTypeOf<Parameters<ProtocolMap['EXPERIMENT_TOGGLE']>[0]>().toEqualTypeOf<{
      id: string; enabled: boolean;
    }>();
  });
});
```

---

### Group D — SW Orchestrator

#### `apps/extension/entrypoints/background.ts` (M)

**Analog:** self — full file `apps/extension/entrypoints/background.ts:1-55`.

**Phase 1 SP-7 pattern (verbatim, lines 12-55):**
```ts
import { defineBackground } from 'wxt/utils/define-background';
import { isExtensionMessage } from '@/shared/messages';
import { setEnabledExperiment } from '@/shared/storage';

// ===== TOP-LEVEL LISTENER (SP-7) =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isExtensionMessage(msg)) return false;
  if (msg.type === 'EXPERIMENT_TOGGLE') {
    handleToggle(msg.id, msg.enabled)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => {
        console.error('[bg] toggle failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep channel open for async sendResponse
  }
  return false;
});

async function handleToggle(id: string, enabled: boolean): Promise<void> {
  await setEnabledExperiment(id, enabled);
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED' });
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}

export default defineBackground(() => {
  // Intentionally empty. State lives in chrome.storage.local; listeners live above.
});
```

**Pattern lock:**
- Top-level listeners (SP-7 / Pitfall 1) — registered BEFORE `defineBackground`.
- `defineBackground` body stays empty (or near-empty) — Phase 2 adds ONE call: `chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})` (R6, idempotent).
- Async handlers wrap in try/catch; never throw at top level.

**Phase 2 shape** (RESEARCH §3 verbatim):
- REPLACE the inline `chrome.runtime.onMessage.addListener` with `onMessage('EXPERIMENT_TOGGLE', ...)` + `onMessage('EXPERIMENT_ERROR', ...)` from `@/shared/messages`.
- INLINE `handleToggle` body moves to `apps/extension/src/background/handlers/experiment-toggle.ts`; this file just calls the imported handler.
- Call `runStartupMigration()` BEFORE the `onMessage` registrations (R7 ordering — migration must run before any handler reads/writes `last_error`). `void runStartupMigration().catch((err) => console.error('[bg] migration failed', err))`.
- ADD `chrome.tabs.onRemoved` top-level listener for `applied:<tabId>` cleanup (RESEARCH §11):
  ```ts
  chrome.tabs.onRemoved.addListener((tabId) => {
    void chrome.storage.session.remove(`applied:${tabId}`);
  });
  ```
- INSIDE `defineBackground(() => { ... })`, add ONE call: `void chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'}).catch(...)` so content scripts can write `applied:<tabId>` (R6).

---

#### `apps/extension/src/background/handlers/experiment-toggle.ts` (C)

**Analog:** Phase 1 inline `handleToggle()` at `apps/extension/entrypoints/background.ts:36-50`.

**Excerpt to extend (verbatim, lines 36-50):**
```ts
async function handleToggle(id: string, enabled: boolean): Promise<void> {
  await setEnabledExperiment(id, enabled);
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED' });
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}
```

**Phase 2 shape (RESEARCH §3 verbatim):**
```ts
import type { ProtocolMap } from '@/shared/messages';
import {
  clearAutoDisable,
  clearErrorWindow,
  setEnabledExperiment,
} from '@/shared/storage';
import { broadcastStateChanged } from '@/background/broadcast';

type Args = Parameters<ProtocolMap['EXPERIMENT_TOGGLE']>[0];
type Result = ReturnType<ProtocolMap['EXPERIMENT_TOGGLE']>;

export async function handleExperimentToggle({ id, enabled }: Args): Promise<Result> {
  try {
    await setEnabledExperiment(id, enabled);
    if (enabled) {
      // D-13 recovery: toggle ON re-arms — clear auto-disable + window counter.
      await clearAutoDisable(id);
      await clearErrorWindow(id);
    }
    await broadcastStateChanged();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
```

**Pattern lock:**
- Args / Result types derived from `ProtocolMap` (RESEARCH §3 idiom — eliminates duplicate-type drift).
- Try/catch around the whole handler body; any throw → `{ ok: false, error }`. Never rethrow.
- D-13 recovery branch (`if enabled` → clear auto-disable + window) is in this handler, not in `clearAutoDisable` itself (single-responsibility helpers).

---

#### `apps/extension/src/background/handlers/experiment-error.ts` (C)

**Analog:** Phase 1 inline `handleToggle()` at `background.ts:36-50` (handler-shape) + RESEARCH §10 (sliding-window math, verbatim).

**Phase 2 shape (RESEARCH §10 verbatim):**
```ts
import type { ErrorReport } from '@/shared/messages';
import {
  clearErrorWindow,
  getErrorWindow,
  setErrorWindow,
  setAutoDisable,
  setLastError,
} from '@/shared/storage';
import { broadcastStateChanged } from '@/background/broadcast';

const WINDOW_MS = 10_000;
const THRESHOLD = 3;

export async function handleExperimentError({
  id, phase, message, stack,
}: ErrorReport): Promise<{ ok: true }> {
  const now = Date.now();
  await setLastError(id, { phase, message, stack, at: now });

  const existing = await getErrorWindow(id);
  let next: { count: number; firstAt: number };
  if (!existing || now - existing.firstAt > WINDOW_MS) {
    next = { count: 1, firstAt: now };
  } else {
    next = { count: existing.count + 1, firstAt: existing.firstAt };
  }
  await setErrorWindow(id, next);

  if (next.count >= THRESHOLD) {
    await setAutoDisable(id, {
      reason: `≥${THRESHOLD} errors in ${WINDOW_MS / 1000}s`,
      count: next.count,
      firstAt: next.firstAt,
      lastAt: now,
    });
    await clearErrorWindow(id);
    await broadcastStateChanged();
  }
  return { ok: true };
}
```

**Pattern lock:**
- Constants `WINDOW_MS`/`THRESHOLD` are file-local (D-11 hardcoded), not env-tunable in Phase 2.
- `AbortError` filtering happens AT THE CALLSITE in content scripts (RESEARCH §10 verbatim), NOT in this handler — this handler trusts callers to pre-filter.
- Sliding-window math is the "fixed window with rolling reset" algorithm (RESEARCH §10 — sufficient for the documented threshold).

---

#### `apps/extension/src/background/broadcast.ts` (C)

**Analog:** Phase 1 inline broadcast loop at `background.ts:39-49` (verbatim):
```ts
const tabs = await chrome.tabs.query({});
await Promise.all(
  tabs.map(async (tab) => {
    if (tab.id == null) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'STATE_CHANGED' });
    } catch {
      // tab has no content script — expected
    }
  }),
);
```

**Phase 2 shape:** extract to a single exported function; use the new `sendMessage` from `@/shared/messages`; per-tab payload `{tabId}` per RESEARCH R8:
```ts
import { sendMessage } from '@/shared/messages';

export async function broadcastStateChanged(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await sendMessage('STATE_CHANGED', { tabId: tab.id }, tab.id);
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}
```

---

#### `apps/extension/src/background/handlers/experiment-toggle.test.ts` (C)

**Analog:** `apps/extension/src/shared/storage.test.ts:1-52` for the chrome-mock + assertion idiom; `apps/extension/src/content/error-isolation.test.ts:28-47` for the helper-direct invocation idiom.

**Excerpt to copy** (`error-isolation.test.ts:28-47` — direct helper invocation, not message-bus integration):
```ts
describe('runEngine error isolation (D-14 / ENG-05 / SP-2)', () => {
  it('a throwing apply() does not prevent subsequent applies', async () => {
    const okApply = vi.fn(async () => () => {});
    const failingApply: ApplyFn = () => { throw new Error('boom'); };
    const result = await runEngine({...});
    expect(result.failed).toContain('01J0AAAAAAAAAAAAAAAAAAAAAA');
    expect(result.applied).toContain('01J0BBBBBBBBBBBBBBBBBBBBBB');
  });
});
```

**Pattern lock:**
- Call the handler function DIRECTLY (`handleExperimentToggle({id, enabled})`); do NOT go through `@webext-core/messaging` — bypasses the bus per RESEARCH §9 ("For unit-testing handlers, bypass the library and call the handler directly").
- Stub `chrome.tabs.query` and `chrome.tabs.sendMessage` with `vi.fn`; assert `chrome.tabs.sendMessage` was called N times for N tabs.
- Use `chrome.storage.local._data['autodisabled']` introspection to seed state (this is the only place we touch `_data` directly — when seeding cross-helper preconditions).

**Phase 2 cases** (RESEARCH §12 row "ENG-06"):
- Toggle ON when `autodisabled[id]` was set: assert `autodisabled` map no longer has `id` AND `error_window:<id>` removed AND `STATE_CHANGED` broadcast fired.
- Toggle OFF: assert `enabled[id] === false`, `STATE_CHANGED` broadcast fired, `autodisabled` untouched.
- SW handler returns `{ok: false, error}` when storage write throws (mock `chrome.storage.local.set` to reject once).

---

#### `apps/extension/src/background/handlers/experiment-error.test.ts` (C)

**Analog:** `apps/extension/src/content/error-isolation.test.ts:48-62` (storage-assertion idiom).

**Excerpt to copy** (`error-isolation.test.ts:48-62`):
```ts
it('records last_error:<id> in chrome.storage.local for failures', async () => {
  const failingApply: ApplyFn = () => { throw new Error('explicit-error-message'); };
  await runEngine({ experiments: [makeExperiment(...)], world: 'isolated', currentURL: 'https://ya.ru/' });
  const stored = await chrome.storage.local.get('last_error:01J0AAAAAAAAAAAAAAAAAAAAAA');
  expect(stored['last_error:01J0AAAAAAAAAAAAAAAAAAAAAA']).toContain('explicit-error-message');
});
```

**Phase 2 cases** (RESEARCH §12 row "ENG-06"):
- 1st error → `error_window:<id>` has `{count: 1, firstAt: <now>}`; `autodisabled` unchanged.
- 2nd error within 10s → `count: 2`.
- 3rd error within 10s → `autodisabled[id]` SET, `error_window:<id>` cleared, broadcast called.
- 1st error → wait > 10s (`vi.useFakeTimers` + `vi.advanceTimersByTime(11000)`) → 2nd error → window resets to `{count:1, firstAt: <new>}` (NOT 2).
- `last_error[id]` is always written with `{phase, message, stack?, at}` — assert shape.

---

### Group E — Engine + Content Scripts

#### `apps/extension/src/content/engine.ts` (M)

**Analog:** self — `apps/extension/src/content/engine.ts:1-81`.

**Existing per-call try/catch + AbortController pattern (verbatim, lines 55-78):**
```ts
for (const exp of filtered) {
  const id = exp.manifest.id;
  try {
    const mod = await exp.load();
    const controller = new AbortController();
    await mod.apply({
      tweaks: {},
      helpers: {
        log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
      },
      currentURL: args.currentURL,
      log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
      signal: controller.signal,
    });
    applied.push(id);
  } catch (err) {
    console.error('[engine] apply failed', id, err);
    await recordLastError(id, String(err)).catch(() => {
      // recording failure must also not break the loop
    });
    failed.push(id);
  }
}
```

**Phase 2 ADDS:**
- A pure `filterAutoDisabled(manifests, autodisabledMap): ExperimentManifest[]` function (D-15) that drops any manifest whose id is in the auto-disabled map. Pure, testable in isolation.
- Per-experiment AbortController retention (D-02) — the controller is created per apply, paired with the cleanup in the cleanup-Map, so reconcile can call `controller.abort()` BEFORE `cleanup()`. This change lives in `content-isolated.content.ts` reconcile (next file), but the engine's tests cover the pattern.

**Pattern lock:** `filterByWorld` stays as-is; `runEngine` may stay or be refactored — Claude's Discretion (the actual Phase 2 reconcile is in the content-script entry, not here).

---

#### `apps/extension/entrypoints/content-isolated.content.ts` (M)

**Analog:** self — `apps/extension/entrypoints/content-isolated.content.ts:1-135`.

**Existing reconcile shape (verbatim, lines 83-134):**
```ts
async function reconcile(
  myLoaders: LoadedManifest[],
  experimentLoaders: Record<string, () => Promise<{ apply: ApplyFn }>>,
): Promise<void> {
  const enabled = await getEnabledExperiments();
  const wantOn = myLoaders.filter(
    (l) => enabled[l.manifest.id] && matchesUrl(location.href, l.manifest.scope.match),
  );
  const wantOnIds = new Set(wantOn.map((l) => l.manifest.id));

  // Cleanup any currently-applied experiment that should no longer be on.
  for (const [id, cleanup] of Array.from(cleanups.entries())) {
    if (!wantOnIds.has(id)) {
      try {
        await cleanup();
      } catch (err) {
        console.error('[engine] cleanup failed', id, err);
        await recordLastError(id, String(err)).catch(() => {});
      }
      cleanups.delete(id);
    }
  }

  // Apply any wanted experiment that isn't yet applied.
  for (const l of wantOn) {
    if (cleanups.has(l.manifest.id)) continue;
    const id = l.manifest.id;
    try {
      const loader = experimentLoaders[l.modulePath];
      if (!loader) { console.warn(...); continue; }
      const mod = await loader();
      const controller = new AbortController();
      const cleanup = await mod.apply({
        tweaks: {},
        helpers: { log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest) },
        currentURL: location.href,
        log: (msg, ...rest) => console.debug('[exp]', id, msg, ...rest),
        signal: controller.signal,
      });
      cleanups.set(id, cleanup);
    } catch (err) {
      console.error('[engine] apply failed', id, err);
      await recordLastError(id, String(err)).catch(() => {});
    }
  }
}
```

**Pattern lock (do not break):**
- `cleanups: Map<id, CleanupFn>` is module-scope in the content-script (NOT the SW). Per-tab state is fine in content-script context (line 38 comment).
- Cleanup phase RUNS BEFORE apply phase (cleanup of wantOff first, then apply of wantOn).
- Per-call try/catch around BOTH `cleanup()` AND `apply()`.
- `import.meta.glob` for both manifests (eager) and modules (lazy) (lines 42-50).

**Phase 2 CHANGES (CONTEXT D-19, D-15, D-02; RESEARCH §11):**

1. **Replace manifest source.** Drop `import.meta.glob('@experiments/*/*/manifest.json', { eager: true })` for manifests; instead `fetch(chrome.runtime.getURL('registry.json')).then(r => r.json())` once on bootstrap. Keep `import.meta.glob('@experiments/*/*/experiment.ts')` for module loaders (D-19 verbatim).

2. **Filter auto-disabled before reconcile.** After `getEnabledExperiments()`, also `getAutoDisabled()`; drop any manifest whose id is in the autodisabled map BEFORE deciding `wantOn` (D-15).

3. **Replace cleanup map value.** Each entry is now `{ cleanup, controller }` so the reconcile can call `controller.abort()` BEFORE `cleanup()` (D-02).

4. **Filter `AbortError` from cleanup throws** (RESEARCH §10):
   ```ts
   try { await cleanup(); }
   catch (err) {
     if (err instanceof DOMException && err.name === 'AbortError') {
       // Successful cooperative cancellation — NOT an error.
     } else {
       await sendMessage('EXPERIMENT_ERROR', {
         id, phase: 'cleanup', message: String(err),
         stack: err instanceof Error ? err.stack : undefined,
       });
     }
   }
   ```

5. **Report apply errors via the bus**, not just `recordLastError`:
   ```ts
   catch (err) {
     await sendMessage('EXPERIMENT_ERROR', {
       id, phase: 'apply', message: String(err),
       stack: err instanceof Error ? err.stack : undefined,
     });
   }
   ```
   (The SW handler now writes `last_error[id]` and runs the auto-disable counter; the content script no longer calls `recordLastError` directly for apply/cleanup throws.)

6. **Write `applied:<tabId>` after each reconcile** (RESEARCH §11):
   ```ts
   await setAppliedInTab(tabId, Array.from(cleanups.keys()));
   ```
   `tabId` comes from the first `STATE_CHANGED` payload (RESEARCH R8 — STATE_CHANGED now carries `{tabId}`); cache it in a module-scope `let myTabId: number | null` (per-document, not per-SW — safe).

7. **Replace `chrome.runtime.onMessage.addListener` with `onMessage('STATE_CHANGED', ({data}) => …)`** from `@/shared/messages`.

---

#### `apps/extension/entrypoints/content-main.content.ts` (M)

**Analog:** self — same shape as `content-isolated.content.ts`, world filter is `'main'`. Phase 1's file is mostly empty (no MAIN experiments yet) — line 54-66 comment explicitly notes Phase 2 wires up the bridge.

**Phase 2 wires up the same changes as `content-isolated`** with these caveats (file's existing comment, lines 53-65):
- MAIN-world has NO `chrome.*` access — cannot directly call `sendMessage` from `@webext-core/messaging` either (it uses `chrome.runtime.sendMessage` under the hood).
- Cross-world bridge → window.postMessage: deferred (CONTEXT line 31, "Two-world bridge" deferred) UNLESS Phase 2 needs MAIN-world experiments to report errors. Phase 1's smoke is `isolated`; no MAIN experiments exist in Phase 2; so MAIN error reporting via the bus is NOT REQUIRED in Phase 2.
- Phase 2 keeps the file as a "wired-but-empty" engine (myLoaders is empty for the smoke); registry source flips to `fetch(getURL('registry.json'))` for parity, error reporting is logged-only (`console.error`) until a MAIN experiment exists.

**Decision the planner must record:** MAIN-world error reporting via window.postMessage bridge is OUT OF SCOPE for Phase 2. The file mirrors `content-isolated` shape but does not call `sendMessage` — it just `console.error`s and writes `applied:<tabId>` via `chrome.storage.session` (after `setAccessLevel('TRUSTED_AND_UNTRUSTED_CONTEXTS')` is set by SW, MAIN gets access too).

---

#### `apps/extension/src/content/contract.test.ts` (C)

**Analog:** none directly. Idiom: `@ts-expect-error` violations to assert the type system enforces the engine contract. RESEARCH §12 + ENG-04 + D-01.

**Pattern (TS-only, runs as part of `tsc --noEmit` / `vitest typecheck`):**
```ts
import type { ApplyFn } from '@platform/experiment-sdk';

// All five fields required by D-01:
const validApply: ApplyFn = ({ tweaks, helpers, currentURL, log, signal }) => {
  void tweaks; void helpers; void currentURL; void log; void signal;
  return () => {};
};

// Deliberate violation: missing `signal` arg destructure should compile (rest fields can be ignored),
// BUT calling the function without the signal field SHOULD fail typing.
// @ts-expect-error — signal is required in ApplyArgs
const _bad: Parameters<ApplyFn>[0] = { tweaks: {}, helpers: { log: () => {} }, currentURL: '', log: () => {} };
```

**Pattern lock:** every `@ts-expect-error` line is accompanied by a comment explaining what would fail if the lock breaks. The test file's purpose is for CI / `tsc --noEmit` to fail if someone removes `signal` (or other required fields) from the contract.

---

#### `apps/extension/src/content/abort-signal.test.ts` (C)

**Analog:** `apps/extension/src/content/error-isolation.test.ts:94-114` (the "apply args include {signal}" assertion).

**Excerpt to copy** (`error-isolation.test.ts:94-114`):
```ts
it('apply args include {tweaks: {}, helpers: {log}, signal, currentURL}', async () => {
  const captured: Parameters<ApplyFn>[0][] = [];
  const apply: ApplyFn = (args) => { captured.push(args); return () => {}; };
  await runEngine({...});
  expect(captured).toHaveLength(1);
  expect(captured[0]?.signal).toBeInstanceOf(AbortSignal);
});
```

**Phase 2 cases** (RESEARCH §12 row "ENG-04"):
- `controller.abort()` is called BEFORE `cleanup()` is invoked (assert via spy on `controller.signal.aborted` from inside the cleanup function).
- An `AbortError` thrown by cleanup is NOT escalated via `EXPERIMENT_ERROR` (assert `sendMessage` mock was NOT called with `EXPERIMENT_ERROR` after an `AbortError`).
- A non-`AbortError` thrown by cleanup IS escalated via `EXPERIMENT_ERROR`.

---

#### `apps/extension/src/content/error-isolation.test.ts` (M)

**Analog:** self — `apps/extension/src/content/error-isolation.test.ts:1-114`.

**Phase 2 ADDS** (RESEARCH §12 row "ENG-06"):
- Reconcile filter test: seed `autodisabled[X] = {…}`, run reconcile with X enabled and matching scope, assert X was NOT applied (regardless of `enabled[X] === true`). Other experiments still apply.

---

### Group F — Build Plugin

#### `tools/build-experiments.ts` (M)

**Analog:** self — `tools/build-experiments.ts:1-167`.

**Existing plugin shape (verbatim, lines 21-33):**
```ts
export function buildExperiments(options: BuildExperimentsOptions = {}): Plugin {
  const root = options.root ?? process.cwd();
  return {
    name: 'platform:build-experiments',
    buildStart() {
      const result = scanAndValidate(root);
      if (result.errors.length > 0) {
        throw new Error(formatErrors(result.errors));
      }
    },
  };
}
```

**Pattern lock:**
- Plugin returned from a function (allows options).
- `name` namespaced as `platform:*`.
- `scanAndValidate` is the pure helper exported for tests; the hook just orchestrates.
- ULID write-back is idempotent (file unchanged when id already present — verified by tests `build-experiments.test.ts:116-132`).
- JSON write shape: `${JSON.stringify(parsed, null, 2)}\n` (line 84 — 2-space indent + trailing newline). Phase 2 `registry.json` uses the same shape (CONTEXT D-16: `JSON.stringify(registry, null, 2) + '\n'`).

**Phase 2 ADDS** (RESEARCH §5 verbatim — preserve `buildStart`, add `generateBundle`):
- Cache `scan: ScanResult | null` between `buildStart` and `generateBundle` (closure-scoped variable inside the plugin factory).
- Add `generateBundle(_options, bundle)` hook:
  - Build `chunkByExperimentPath: Map<absExperimentTs, fileName>` from `bundle` entries where `asset.type === 'chunk'` and `facadeModuleId` matches `/[/\\]experiments[/\\][^/\\]+[/\\][^/\\]+[/\\]experiment\.ts$/`.
  - Map each `scan.manifests` entry to a `RegistryEntry`: copy `id, author, name, description, scope, world, tweaks` from `data`; resolve `chunkPath` from the lookup (or `''` sentinel if not found, per Option A in RESEARCH §5; or guarantee non-empty via `manualChunks`, Option B which is the recommendation).
  - `this.emitFile({type: 'asset', fileName: 'registry.json', source: \`\${JSON.stringify(registry, null, 2)}\n\`})`.

---

#### `apps/extension/wxt.config.ts` (M)

**Analog:** self — `apps/extension/wxt.config.ts:1-37`.

**Existing config (verbatim, lines 11-36):**
```ts
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Designer Experiment Platform',
    description: 'Phase 1 foundation skeleton',
    version: '0.0.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['*://ya.ru/*', '*://*.ya.ru/*'],
  },
  vite: () => ({
    plugins: [tailwindcss(), buildExperiments({ root: repoRoot })],
    resolve: {
      alias: {
        '@/': `${resolve(__dirname, 'src')}/`,
        '@experiments': resolve(repoRoot, 'experiments'),
      },
    },
  }),
});
```

**Pattern lock:**
- Aliases are duplicated in BOTH `wxt.config.ts` (Vite runtime) AND `apps/extension/tsconfig.json` `paths` (TS editor) — line 28-29 comment.
- Plugin order: tailwindcss FIRST, then domain plugins.

**Phase 2 ADDS** (RESEARCH §5 verbatim, CONTEXT D-17):
```ts
vite: () => ({
  plugins: [tailwindcss(), buildExperiments({ root: repoRoot })],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        manualChunks(id) {
          const m = id.match(/[/\\]experiments[/\\]([^/\\]+)[/\\]([^/\\]+)[/\\]experiment\.ts$/);
          if (!m) return undefined;
          const [, author, folder] = m;
          return `experiments-${author}-${folder}`;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@/': `${resolve(__dirname, 'src')}/`,
      '@experiments': resolve(repoRoot, 'experiments'),
    },
  },
}),
```

**No `web_accessible_resources`** — RESEARCH §6 confirms not needed for popup or content-script `getURL` access from extension origin.

---

#### `tools/build-experiments.test.ts` (M)

**Analog:** self — `tools/build-experiments.test.ts:1-206`.

**Existing test idiom (verbatim, lines 15-33):**
```ts
let tmpRoot: string;

beforeEach(() => {
  tmpRoot = resolve(tmpdir(), `build-experiments-test-${Date.now()}-${Math.random()...}`);
  mkdirSync(tmpRoot, { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeManifest(rel: string, value: unknown): string {
  const abs = resolve(tmpRoot, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return abs;
}
```

**Pattern lock:**
- Per-test `tmpRoot` (no shared mutable state).
- `writeManifest`/`writeFixture` helpers for setup.
- `scanAndValidate(tmpRoot)` is the unit under test — direct call, no Vite invocation.

**Phase 2 ADDS** (RESEARCH §12 rows "BLD-03" + "BLD-04"):
- For `registry.json` shape: invoke the plugin's `generateBundle` hook directly with a mock `bundle` (or invoke Vite programmatically with fixture experiments via `import { build } from 'vite'` and capture `outDir` contents). Assert `registry.json` exists in output, parses to JSON, has the 8 fields per entry.
- For chunk-path mapping: assert each `RegistryEntry.chunkPath` corresponds to a `chunks/experiments-<author>-<folder>-<hash>.js` file actually emitted to the output directory.

---

### Group G — Popup Shell — shadcn Scaffolding

The CLI generates these files; the executor reviews them but does not author them. Pattern source: shadcn/ui CLI 4.x output (RESEARCH §4).

#### `apps/extension/components.json` (C)

**Analog:** none — first shadcn install in the repo.

**Expected shape (RESEARCH §4 verbatim):**
```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/popup.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "hooks": "@/hooks",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}
```

**Verification (R3):** after `pnpm dlx shadcn@latest init`, run `pnpm typecheck` to confirm `apps/extension/tsconfig.json` `paths` resolves `@/components/ui/...` (Phase 1's tsconfig already has `paths: { "@/*": ["./src/*"] }` at line 9 — should "just work").

---

#### `apps/extension/src/lib/utils.ts` (C)

**Analog:** none. Generated by `shadcn init`. Standard content:
```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

---

#### `apps/extension/src/components/ui/{switch,card,collapsible,badge,scroll-area,button}.tsx` (C, six files)

**Analog:** none — generated by `pnpm dlx shadcn@latest add <name>`. Source lives in tree under shadcn's copy-paste model (UI-SPEC §"Registry Safety").

**Pattern lock (UI-SPEC + CONTEXT D-23):**
- Do NOT modify the generated component files in Phase 2. If a customization is needed (e.g., the auto-disabled badge variant override), apply it at the CALLSITE via `className` prop (CONTEXT D-23 + UI-SPEC §"Status Badge Contract").
- The auto-disabled badge override is documented as a comment in `ExperimentRow.tsx`, not in `badge.tsx` (UI-SPEC line 224 verbatim).

---

#### `apps/extension/src/styles/popup.css` (M)

**Analog:** self — `apps/extension/src/styles/popup.css:1-9`.

**Existing content (verbatim, full file):**
```css
@import "tailwindcss";

body {
  margin: 0;
  padding: 0.75rem;
  min-width: 280px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

**Phase 2 CHANGES** (UI-SPEC + RESEARCH §4):
- `shadcn init` AUGMENTS this file: adds `@plugin "tw-animate-css";` and an `@theme inline { --color-* … }` block with light + dark slate vars (~80-120 lines total post-init). UI-SPEC line 64 mandates the executor PRESERVE the Phase 1 body styles after init.
- Replace `min-width: 280px` with `width: 360px; max-height: 560px;` per UI-SPEC §"Popup Outer Dimensions". Keep `padding: 0.75rem; font-family: ...; margin: 0`.
- ADD a `@media (prefers-reduced-motion: reduce) { [data-state] { animation: none !important; } }` block (UI-SPEC §"Accessibility Contract").

---

### Group H — Popup Shell — Authored

#### `apps/extension/src/popup/store.ts` (C)

**Analog:** none in tree (Phase 1 popup used local `useState`, no Zustand). Pattern verbatim from RESEARCH §8.

**Code shape (RESEARCH §8 verbatim — ~50 lines):**
```ts
import { create, type StateCreator } from 'zustand';
import type { AutoDisableRecord, ErrorRecord, Registry } from '@platform/experiment-sdk';

type RegistrySlice = { registry: Registry; setRegistry: (r: Registry) => void };
const registrySlice: StateCreator<RootState, [], [], RegistrySlice> = (set) => ({
  registry: [],
  setRegistry: (r) => set({ registry: r }),
});

type StorageSlice = {
  enabled: Record<string, boolean>;
  autodisabled: Record<string, AutoDisableRecord>;
  lastError: Record<string, ErrorRecord>;
  setEnabled: (e: Record<string, boolean>) => void;
  setAutoDisabled: (a: Record<string, AutoDisableRecord>) => void;
  setLastError: (m: Record<string, ErrorRecord>) => void;
};
const storageSlice: StateCreator<RootState, [], [], StorageSlice> = (set) => ({
  enabled: {}, autodisabled: {}, lastError: {},
  setEnabled: (e) => set({ enabled: e }),
  setAutoDisabled: (a) => set({ autodisabled: a }),
  setLastError: (m) => set({ lastError: m }),
});

type TabSlice = {
  activeTabId: number | null;
  appliedInActiveTab: string[];
  setActiveTab: (id: number | null) => void;
  setAppliedInActiveTab: (ids: string[]) => void;
};
const tabSlice: StateCreator<RootState, [], [], TabSlice> = (set) => ({
  activeTabId: null, appliedInActiveTab: [],
  setActiveTab: (id) => set({ activeTabId: id }),
  setAppliedInActiveTab: (ids) => set({ appliedInActiveTab: ids }),
});

type RootState = RegistrySlice & StorageSlice & TabSlice;

export const useStore = create<RootState>()((...a) => ({
  ...registrySlice(...a),
  ...storageSlice(...a),
  ...tabSlice(...a),
}));
```

**Pattern lock (RESEARCH §8 / D-27):**
- Three slices, composed in `create<RootState>()((...a) => ({...sliceA(...a), ...sliceB(...a)}))`.
- `useStore.setState(partial)` callable from outside React (used by the storage.onChanged listener in `main.tsx`).
- Granular selectors at callsites: `useStore((s) => s.enabled[id])`, NOT `useStore((s) => s)`.

---

#### `apps/extension/src/popup/status.ts` (C)

**Analog:** `apps/extension/src/shared/url-match.ts` (Phase 1 pure-function shape — single exported function, no React, no chrome.*).

**Pattern lock (Phase 1 url-match shape):**
- Single named export, pure, takes data + returns data.
- No side effects.
- Co-located test file with truth-table coverage.

**Phase 2 shape (RESEARCH §8 verbatim):**
```ts
import type { AutoDisableRecord, ExperimentStatus, RegistryEntry } from '@platform/experiment-sdk';
import { matchesUrl } from '@/shared/url-match';

export function computeStatus(
  entry: RegistryEntry,
  ctx: {
    enabled: boolean;
    autodisabled?: AutoDisableRecord;
    appliedInActiveTab: string[];
    activeTabUrl?: string;
  },
): ExperimentStatus {
  if (ctx.autodisabled) return 'auto-disabled';
  if (!ctx.enabled) return 'disabled';
  const scopeMatches = ctx.activeTabUrl != null && matchesUrl(ctx.activeTabUrl, entry.scope.match);
  if (!scopeMatches) return 'pending';
  if (ctx.appliedInActiveTab.includes(entry.id)) return 'applied';
  return 'error';
}
```

---

#### `apps/extension/src/popup/grouping.ts` (C)

**Analog:** `apps/extension/src/shared/url-match.ts` (pure-function shape, same as `status.ts`).

**Pattern (CONTEXT D-22):**
```ts
import type { Registry, RegistryEntry } from '@platform/experiment-sdk';

export type AuthorGroup = { author: string; entries: RegistryEntry[]; defaultOpen: boolean };

export function groupByAuthor(
  registry: Registry,
  ctx: { activeTabUrl?: string; matchesUrl: (url: string, patterns: string[]) => boolean },
): AuthorGroup[] {
  const byAuthor = new Map<string, RegistryEntry[]>();
  for (const e of registry) {
    const list = byAuthor.get(e.author) ?? [];
    list.push(e);
    byAuthor.set(e.author, list);
  }
  return Array.from(byAuthor.entries())
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))  // D-22: alphabetical, case-insensitive
    .map(([author, entries]) => ({
      author,
      entries,
      defaultOpen: ctx.activeTabUrl != null
        && entries.some((e) => ctx.matchesUrl(ctx.activeTabUrl!, e.scope.match)),
    }));
}
```

---

#### `apps/extension/entrypoints/popup/main.tsx` (M)

**Analog:** self — `apps/extension/entrypoints/popup/main.tsx:1-12`.

**Phase 1 (verbatim, full file):**
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/popup.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('popup: #root missing');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Pattern lock:**
- React mount idiom unchanged: `createRoot(container).render(<StrictMode>...)`.
- CSS imported at top of `main.tsx`, not in `App.tsx`.

**Phase 2 ADDS** (RESEARCH §8 verbatim — bootstrap before mount + storage.onChanged):
- An `async function bootstrapStore()` that fetches `registry.json`, reads initial storage (enabled, autodisabled, lastError), reads active tab id, populates the store.
- A `chrome.storage.onChanged.addListener((changes, areaName) => ...)` registered ONCE at module top, AFTER the bootstrap call but BEFORE the React mount (RESEARCH §8 verbatim).
- The mount stays the same: `createRoot(container).render(<StrictMode><App/></StrictMode>)`.

---

#### `apps/extension/entrypoints/popup/App.tsx` (M)

**Analog:** self — `apps/extension/entrypoints/popup/App.tsx:1-71` — Phase 1 inline-checkbox list.

**Phase 1 row idiom (lines 47-66):**
```tsx
<li key={row.manifest.id} style={{display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0'}}>
  <input
    type="checkbox"
    checked={enabled[row.manifest.id] ?? false}
    onChange={(e) => handleToggle(row.manifest.id, e.target.checked)}
  />
  <span>{row.manifest.name} <small style={{color: '#888'}}>by {row.manifest.author}</small></span>
</li>
```

**Phase 1 toggle dispatch (lines 29-32):**
```tsx
const handleToggle = (id: string, next: boolean) => {
  setEnabled((prev) => ({ ...prev, [id]: next }));
  chrome.runtime.sendMessage({ type: 'EXPERIMENT_TOGGLE', id, enabled: next });
};
```

**Phase 1 empty-state (lines 34-41) — PRESERVED VERBATIM per UI-SPEC line 285:**
```tsx
if (rows.length === 0) {
  return (
    <div>
      No experiments yet. Add one under <code>experiments/&lt;you&gt;/&lt;id&gt;/</code> and
      rebuild.
    </div>
  );
}
```

**Phase 2 SHAPE (UI-SPEC §"Component Inventory" verbatim):**
- Replace `useState`/`useEffect`/`loadManifests` with Zustand selectors: `const registry = useStore((s) => s.registry); const groups = useMemo(() => groupByAuthor(registry, {activeTabUrl, matchesUrl}), [registry, activeTabUrl])`.
- Replace inline `<input type="checkbox">` rows with `<AuthorGroup>` → `<ExperimentRow>` Card components.
- Replace `chrome.runtime.sendMessage({type, ...})` with `sendMessage('EXPERIMENT_TOGGLE', {id, enabled})` from `@/shared/messages`.
- Wrap experiment list in `<ScrollArea>` per UI-SPEC §"Layout Anatomy".
- Header: `<h1>Experiments</h1>` + `<Badge variant="secondary">{enabledCount}</Badge>` (UI-SPEC §"Copywriting Contract").
- Bootstrap-loading transient: `if (registry.length === 0 && !bootstrapped) return <div>Reading state…</div>;` (UI-SPEC line 287).

**Pattern lock:** the empty-state copy is preserved verbatim from Phase 1 (UI-SPEC line 285 mandates this). Toggle dispatch swaps to `sendMessage` but keeps the optimistic-update pattern (set local state, send message, on error response snap back — UI-SPEC line 239).

---

#### `apps/extension/entrypoints/popup/components/AuthorGroup.tsx` (C)

**Analog:** none in tree. Pattern from UI-SPEC §"Collapsible Behavior Contract" + shadcn `Collapsible` docs.

**Pattern (UI-SPEC §"Component Inventory"):**
```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ExperimentRow } from './ExperimentRow';
import type { AuthorGroup as Group } from '@/popup/grouping';

export function AuthorGroup({ group }: { group: Group }) {
  return (
    <Collapsible defaultOpen={group.defaultOpen} className="mt-3">
      <CollapsibleTrigger className="flex w-full items-center gap-1 text-sm font-semibold h-8">
        {/* chevron driven by data-state */}
        {group.author} ({group.entries.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {group.entries.map((e) => <ExperimentRow key={e.id} entry={e} />)}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

---

#### `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` (C)

**Analog:** Phase 1 row idiom in `App.tsx:47-66` (above) for the data-flow shape; UI-SPEC §"Card internal layout" + §"Status Badge Contract" + §"Switch (Toggle) Behavior Contract" for the visual.

**Pattern (UI-SPEC §"Component Inventory"):**
- Card with `p-3` padding (override shadcn default `p-6` per UI-SPEC line 127).
- Row 1: name + status Badge (justify-between).
- Row 2: description (`text-sm text-muted-foreground`, line-clamp-2).
- Row 3: Switch (justify-end). `aria-label="Toggle {entry.name}"`.
- Conditional: error block (1-line short error + `<Collapsible>` for stack trace) when status is `error` or `auto-disabled`.
- Auto-disabled badge override: `<Badge variant="destructive" className="bg-transparent text-destructive border-destructive border">Auto-disabled</Badge>` (UI-SPEC line 224 verbatim — comment must be in the source).
- Toggle handler: optimistic update + `await sendMessage('EXPERIMENT_TOGGLE', {id, enabled})`; on `{ok: false}` response, snap state back AND render `<p class="text-xs text-destructive mt-2">Toggle failed: {error}</p>` inline (UI-SPEC line 239).
- Pending spinner: `<Loader2 className="size-3 animate-spin" />` shown while `runtime.sendMessage` is in flight (UI-SPEC line 238).

---

#### `apps/extension/entrypoints/popup/App.test.tsx` (C)

**Analog:** none — first popup test (jsdom env is new in Phase 2). Idiom: React Testing Library + Phase 1 chrome-mock.

**Pattern (RESEARCH §12 row "UI-01"):**
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useStore } from '@/popup/store';

describe('Popup App', () => {
  it('renders 5 status badge variants', () => {
    useStore.setState({
      registry: [/* fixture entries with each of 5 statuses */],
      enabled: { /* ... */ },
      autodisabled: { /* ... */ },
      lastError: { /* ... */ },
      appliedInActiveTab: [/* ... */],
      activeTabId: 1,
    });
    render(<App />);
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Auto-disabled')).toBeInTheDocument();
  });

  it('toggle dispatches EXPERIMENT_TOGGLE via sendMessage', async () => {
    // mock sendMessage; click switch; assert called with {id, enabled: true}
  });
});
```

**Pattern lock:**
- Per-test `useStore.setState(...)` to seed state (Zustand store is module-singleton; reset in `beforeEach` if needed).
- `// @vitest-environment jsdom` pragma at top of file (or set globally in `vitest.config.ts` — Claude's Discretion).
- `@testing-library/react` queries (`screen.getByText`, `screen.getByRole`).
- Empty-state assertion from UI-SPEC line 285.

---

#### `apps/extension/src/popup/store.test.ts` (C)

**Analog:** `apps/extension/src/shared/storage.test.ts` (chrome-mock + assertion shape).

**Pattern lock:**
- Reset store between tests via `useStore.setState({...initialState})` in `beforeEach`.
- Test slice composition: `setRegistry` updates `registry`, doesn't clobber `enabled` etc.
- Test storage.onChanged path: simulate a `chrome.storage.onChanged` fire by calling the registered listener (the chrome-mock's `onChanged.addListener` records it; tests can pull the registered fn out and call it directly).

---

#### `apps/extension/src/popup/{status,grouping}.test.ts` (C)

**Analog:** Phase 1 `apps/extension/src/shared/url-match.test.ts` (pure-function truth-table style).

**Pattern lock:**
- Pure-function tests, no chrome-mock needed (these helpers don't touch `chrome.*`).
- Truth-table coverage: `status.test.ts` covers all 5 status outputs across cells of `(enabled, autodisabled, scopeMatches, applied)`; `grouping.test.ts` covers alphabetical sort + case-insensitivity + count + `defaultOpen` logic.

---

### Group I — Test Setup

#### `apps/extension/src/test-setup/chrome-mock.ts` (M)

**Analog:** self — `apps/extension/src/test-setup/chrome-mock.ts:1-71`.

**Existing pattern (verbatim, lines 26-66):**
```ts
function makeStorageArea(): StorageAreaMock {
  const data: StorageRecord = {};
  const area: StorageAreaMock = {
    _data: data,
    get: vi.fn(async (keys?: string | string[] | null) => { /* ... */ }),
    set: vi.fn(async (items: StorageRecord) => { Object.assign(data, items); }),
    remove: vi.fn(async (key: string) => { delete data[key]; }),
    clear: vi.fn(async () => { for (const k of Object.keys(data)) delete data[k]; }),
  };
  return area;
}

export function makeChromeMock(): ChromeMock {
  return {
    storage: { local: makeStorageArea(), session: makeStorageArea() },
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      sendMessage: vi.fn(),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      sendMessage: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', makeChromeMock());
});
```

**Pattern lock:**
- `_data` exposed for test introspection.
- `vi.stubGlobal('chrome', makeChromeMock())` per `beforeEach` — fresh mock each test.
- `vi.fn` everything; tests can spy on calls and override per-test via `chrome.tabs.query = vi.fn(async () => [...])` (per-test override pattern from `error-isolation.test.ts`).

**Phase 2 ADDS** (RESEARCH §9 verbatim):
- `chrome.storage.onChanged: { addListener, removeListener, hasListener }` with a `changeListeners[]` registry. `set`/`remove` must `fireChange()` to registered listeners with `(changes, areaName)` args.
- `chrome.storage.session.setAccessLevel: vi.fn(async () => {})` — no-op mock; tests assert it was called.
- `chrome.runtime.getURL: vi.fn((p) => 'chrome-extension://test/' + p.replace(/^\//, ''))`.

---

#### `apps/extension/vitest.config.ts` (M)

**Analog:** self — `apps/extension/vitest.config.ts:1-19`.

**Existing config (verbatim, full file):**
```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: 'extension',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/test-setup/chrome-mock.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

**Phase 2 CHANGES (RESEARCH §12 + §14):**
- `include` widens to also pick up `entrypoints/**/*.test.tsx` (popup tests live next to `App.tsx`).
- Either set `environment: 'jsdom'` globally (simplest, but slows node-only tests) OR keep `node` global and rely on per-file `// @vitest-environment jsdom` pragmas (recommended; Claude's Discretion).
- Confirm `setupFiles` still loads chrome-mock for popup tests (it should — global setup applies regardless of env).

---

## Shared Patterns (Cross-Cutting Conventions)

These patterns apply to multiple new/modified files. Each has a Phase 1 in-repo source.

### SP-1: Stateless Service Worker (carried forward unchanged)

**Source:** Phase 1 — CONTEXT D-12, `apps/extension/entrypoints/background.ts:1-55` (no module-scope state), Phase 1 PATTERNS SP-1.

**Apply to (Phase 2):** `entrypoints/background.ts`, `src/background/handlers/experiment-toggle.ts`, `src/background/handlers/experiment-error.ts`, `src/background/broadcast.ts`.

**Rule:** No module-scope `let`/`const` holding mutable state in the SW. ALL counters / flags / data live in `chrome.storage.{local,session}` via the typed helpers in `src/shared/storage.ts`. Tested via the SW-stop manual smoke (RESEARCH §12 row #2) AND the unit tests where each handler is invoked fresh and reads/writes via storage helpers.

---

### SP-2: Per-Call Error Isolation (carried forward unchanged)

**Source:** Phase 1 — `apps/extension/src/content/engine.ts:55-78` and `apps/extension/entrypoints/content-isolated.content.ts:96-133` (cleanup + apply each in own try/catch).

**Apply to (Phase 2):** `entrypoints/content-isolated.content.ts`, `entrypoints/content-main.content.ts`, `src/content/engine.ts`.

**Rule:** every `apply()` and every `cleanup()` is wrapped in its OWN try/catch. Loop continues after a caught error. Errors flow to the SW via `sendMessage('EXPERIMENT_ERROR', {…})` for counting (Phase 2 evolution); `recordLastError` direct-write goes away from content scripts.

---

### SP-3: Static Discovery via `import.meta.glob` (refined for Phase 2)

**Source:** Phase 1 — `apps/extension/entrypoints/content-isolated.content.ts:42-50` + `content-main.content.ts:34-38` + `popup/App.tsx:8-19`.

**Phase 2 evolution (CONTEXT D-19):**
- Manifest discovery moves from `import.meta.glob('@experiments/*/*/manifest.json', {eager: true})` → `fetch(chrome.runtime.getURL('registry.json'))`. The popup AND content scripts now both read `registry.json` (built by `tools/build-experiments.ts` `generateBundle`).
- Module loaders KEEP `import.meta.glob('@experiments/*/*/experiment.ts')` (NOT eager) — Vite still produces one chunk per dynamic-import target; this is BLD-04.

**Apply to:** `entrypoints/content-isolated.content.ts`, `entrypoints/content-main.content.ts`, `entrypoints/popup/main.tsx`, `entrypoints/popup/App.tsx`.

---

### SP-4: Zod Manifest as Single Source of Truth (carried forward)

**Source:** `packages/experiment-sdk/src/index.ts:14-26` (the schema), `tools/build-experiments.ts:93-104` (build-time validation), Phase 1 PATTERNS SP-4.

**Apply to:** any new place reading manifest data — but Phase 2 mostly reads `RegistryEntry` (already-validated by build), so the only new touch is the build-time emission validating before write.

---

### SP-7: Top-Level Listener Registration (carried forward)

**Source:** Phase 1 — `apps/extension/entrypoints/background.ts:18-34` (top-level `chrome.runtime.onMessage.addListener`), `content-isolated.content.ts:74-80` (top-level `STATE_CHANGED` listener).

**Apply to (Phase 2):**
- `entrypoints/background.ts`: top-level `onMessage('EXPERIMENT_TOGGLE', …)`, `onMessage('EXPERIMENT_ERROR', …)`, `chrome.tabs.onRemoved.addListener(…)` (RESEARCH §11). All BEFORE `defineBackground`.
- `entrypoints/content-isolated.content.ts`: top-level `onMessage('STATE_CHANGED', …)` inside the WXT `main()` callback (which IS top-level for content scripts; content scripts re-execute on each navigation, no idle-termination concern).

**Rule:** `onMessage` (from `@webext-core/messaging`) is a synchronous wrapper around `chrome.runtime.onMessage.addListener`; calling it at module top preserves SP-7. Confirmed by RESEARCH R1.

---

### SP-8 (NEW): Storage-driven Pull, Not Push (Phase 2)

**Source:** CONTEXT D-09, D-10. No Phase 1 analog.

**Apply to:** `src/popup/store.ts`, `entrypoints/popup/main.tsx`, `src/background/handlers/experiment-toggle.ts`, `src/background/handlers/experiment-error.ts`.

**Rule:** the SW does NOT push status updates to the popup. The popup subscribes to `chrome.storage.onChanged` and re-derives status via `computeStatus()`. SW handlers WRITE to storage; popup READS via the onChanged listener. Tested by simulating a storage change in the popup test and asserting the store updated.

---

### SP-9 (NEW): ULID-keyed Storage Convention (Phase 2)

**Source:** CONTEXT D-28 (locked key shapes table).

**Apply to:** all storage helpers in `src/shared/storage.ts`, all storage assertions in tests.

**Rule:** every per-experiment storage key is keyed by ULID, never folder path. Locked keys (D-28 verbatim):
- `enabled: Record<ulid, boolean>` (storage.local)
- `autodisabled: Record<ulid, AutoDisableRecord>` (storage.local)
- `last_error: Record<ulid, ErrorRecord>` (storage.local)
- `error_window:<ulid>` (storage.session)
- `applied:<tabId>: ulid[]` (storage.session) — keyed by tabId not ulid; ulids are inside the array
- `tweaks:<ulid>` (storage.local) — RESERVED for Phase 3, declared in storage.ts but no helpers
- `preset:<ulid>:<name>` (repo file under `presets/`) — RESERVED for Phase 5, no Phase 2 implementation

---

## Deviations (Pattern Evolutions)

Only ONE true convention evolution exists in Phase 2:

### D-1: `apps/extension/src/shared/messages.ts` REPLACES tag-union with `defineExtensionMessaging<ProtocolMap>()`

**Source:** CONTEXT D-04.

**Why allowed:** Phase 1's file explicitly predicted this in a doc-comment (`messages.ts:5: "Phase 2 will introduce richer messages via @webext-core/messaging"`). The library is by the WXT author (`@aklinker1`), preserves SP-7 (RESEARCH R1).

**Consumers updated:** `apps/extension/entrypoints/background.ts`, `apps/extension/entrypoints/content-isolated.content.ts`, `apps/extension/entrypoints/content-main.content.ts`, `apps/extension/entrypoints/popup/App.tsx`.

**Removed:** `isExtensionMessage` runtime guard.

### D-2 (refinement, not deviation): `STATE_CHANGED` payload enriched with `{tabId}`

**Source:** RESEARCH R8 (Claude's Discretion — within D-05's "the broadcast mechanism is the same; only the payload is enriched").

**Why allowed:** content scripts cannot directly query their own tab id (no Chrome API for "my tab"). The cleanest solution is for the SW to include `{tabId}` in each per-tab broadcast — already iterating tabs to send the message, only adds one field. Recorded as a refinement of D-05, not a violation.

### D-3 (refinement): Popup tests use jsdom (Phase 1 was node-only)

**Source:** RESEARCH §12 row "UI-01".

**Why allowed:** popup is React; jsdom is the standard React Testing Library env. Phase 1's tests were all pure logic (storage, engine, manifest) → `node` was correct. Phase 2 adds component tests that need a DOM. Either flip the global env to jsdom OR use per-file pragma (Claude's Discretion).

### Everything else is purely additive

- New files in `apps/extension/src/background/handlers/` — no precedent; Claude's Discretion per CONTEXT line 187.
- New shadcn `ui/` directory — first install; copy-paste convention per shadcn CLI.
- New `apps/extension/src/lib/` directory — first install; generated by shadcn `init`.
- New `apps/extension/src/popup/` directory — first authored popup logic; pattern from RESEARCH §8.
- New `apps/extension/components.json` — first install; pattern from RESEARCH §4.
- All new `*.test.ts` files — extend the Phase 1 chrome-mock + Vitest convention.

---

## No Analog Found

None of the 49 files lack guidance — even the 9 files with no in-repo analog have authoritative external sources with verbatim code shapes in RESEARCH and UI-SPEC.

| File | Source of truth (no in-repo analog) |
|---|---|
| `apps/extension/components.json` | shadcn CLI output — RESEARCH §4 verbatim block |
| `apps/extension/src/lib/utils.ts` | `shadcn init` standard output (clsx + tailwind-merge `cn`) |
| `apps/extension/src/components/ui/{switch,card,collapsible,badge,scroll-area,button}.tsx` (6 files) | `shadcn add <name>` outputs — pattern is "do not modify, customize at callsite" (UI-SPEC §"Status Badge Contract") |
| `apps/extension/src/popup/store.ts` | RESEARCH §8 verbatim Zustand 5 slice composition |

---

## Planner Summary (read this if nothing else)

1. **This is a brownfield phase.** Phase 1 produced in-repo analogs for almost every Phase 2 file. The greenfield disclaimer no longer applies.
2. **Pattern lock-in is real.** SP-1 (stateless SW), SP-2 (per-call try/catch), SP-3 (build-time discovery), SP-7 (top-level listener), SP-9 (ULID-keyed storage) — all enforced.
3. **One true evolution:** `apps/extension/src/shared/messages.ts` REPLACES the Phase 1 tag-union with `@webext-core/messaging` (D-04, locked). All other changes are additive.
4. **Two minor refinements within Claude's Discretion:** STATE_CHANGED payload enriched with `{tabId}` (R8); popup tests run in jsdom (R3).
5. **Per-file action pattern:** for each new/modified file, the planner can construct `<read_first>` from:
   - The Phase 1 analog file:line excerpt above (for shape, idioms, conventions).
   - The verbatim code block from RESEARCH §3-§11 or UI-SPEC §"Component Inventory" (for net-new code shapes).
   - The locked decision IDs (D-04, D-28, etc.) for invariants.
6. **Shared patterns SP-1..SP-9** apply transversally; reference them from each plan instead of repeating.
7. **Wave 0 dependencies (RESEARCH §1):** test infrastructure (extended chrome-mock, jsdom env, RTL) + SDK type extensions + storage helpers + idempotent migration + the fresh `messages.ts` shape — all must land BEFORE downstream waves can write tests against them.

---

## Metadata

**Pattern extraction date:** 2026-04-25
**Repo state:** Phase 1 shipped + verified (commit `44bf2e1`); Phase 2 starts brownfield.
**Files scanned:** 13 Phase 1 source files + 4 Phase 1 test files + Phase 1 PATTERNS.md + Phase 1 CONTEXT.md + Phase 2 CONTEXT.md + Phase 2 RESEARCH.md + Phase 2 UI-SPEC.md.
**Sources consulted:**
- Phase 1: `01-CONTEXT.md`, `01-PATTERNS.md`, in-tree code (background.ts, storage.ts, messages.ts, engine.ts, content-isolated.content.ts, content-main.content.ts, popup/main.tsx, popup/App.tsx, wxt.config.ts, package.json, tsconfig.json, popup.css, vitest.config.ts, chrome-mock.ts, build-experiments.ts, experiment-sdk/src/index.ts, plus test files)
- Phase 2: `02-CONTEXT.md` (D-01..D-31), `02-RESEARCH.md` (§3-§11 + §14), `02-UI-SPEC.md` (full)

**Planner note:** every code block in this document is either VERBATIM from a Phase 1 file (with file:line citation) or VERBATIM from RESEARCH/UI-SPEC. The planner can paste these into `<read_first>` blocks without paraphrasing. Where Claude's Discretion is invoked (file layout under `src/background/handlers/`, jsdom global vs per-file pragma, MAIN-world error reporting deferral), the planner records the decision in `02-PLAN.md` under DEVIATIONS.

## PATTERN MAPPING COMPLETE
