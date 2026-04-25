# Phase 2: State Foundation, Messaging & Popup Shell — Research

**Researched:** 2026-04-25
**Domain:** Typed messaging bus (`@webext-core/messaging`), shadcn/ui popup shell on WXT 0.20 + Tailwind v4 + React 19, Vite/Rollup `generateBundle` for `dist/registry.json` + per-experiment chunks, `chrome.storage.session` extension for sliding-window error counters and per-tab applied set, Zustand 5 store driven by `chrome.storage.onChanged`, idempotent storage migration.
**Confidence:** HIGH (architecture; all 31 user decisions are LOCKED — research is "how", not "what"). MEDIUM-HIGH on `@webext-core/messaging` SP-7 ordering, shadcn-CLI inside a WXT subpackage, and Vite chunk-naming wiring (verified at the doc level; the planner must include a Wave-0 verification task that exercises each on the live tree).

> **Verification posture:** All 31 D-decisions in 02-CONTEXT.md are LOCKED via `--auto`. This document does NOT explore alternatives — it concretizes implementation specifics, code shapes, and risk mitigations the planner needs. Every claim is tagged `[VERIFIED]`, `[CITED: <url>]`, or `[ASSUMED]`. The Phase 1 spike already verified MV3 SP-1/SP-7 invariants in the live tree (`docs/spike/MV3-FOUNDATION.md` + `01-VERIFICATION.md`); Phase 2 inherits and extends them.

---

<user_constraints>
## User Constraints (from 02-CONTEXT.md)

### Locked Decisions

**Engine Contract Hardening (ENG-04)**
- **D-01:** `apply({tweaks, helpers, currentURL, log, signal}) → cleanup` is locked verbatim from Phase 1 SDK; Phase 2 makes it *enforced* via a TS-only test (`apps/extension/src/content/contract.test.ts`) that compiles a deliberate violation to assert the type error.
- **D-02:** `signal: AbortSignal` is honored on cleanup. Reconcile loop creates `AbortController` per applied experiment, calls `controller.abort()` BEFORE `cleanup()`. `AbortError` from cleanup is treated as success (NOT counted toward auto-disable).
- **D-03:** `helpers` stays `{log}` only in Phase 2; `injectStyle/injectNode/waitFor/onUrlChange/llm/fetchPage` arrive in Phase 4.

**Messaging Bus & SW Orchestrator**
- **D-04:** Adopt `@webext-core/messaging` for typed messages popup ↔ SW ↔ content scripts. Replaces hand-rolled `isExtensionMessage` tag union.
- **D-05:** Message catalogue (Phase 2):
  - `EXPERIMENT_TOGGLE` (popup → SW): `{id: string, enabled: boolean}` → `{ok: true} | {ok: false, error: string}`
  - `STATE_CHANGED` (SW → all tabs broadcast): no payload
  - `EXPERIMENT_ERROR` (content script → SW): `{id, phase: 'apply'|'cleanup', message, stack?}` → `{ok: true}`. SW counts toward auto-disable window and persists `last_error[id]`.
  - `STATUS_QUERY` (popup → active content script): no payload → `{[id]: ExperimentStatus}`
  - **No** `STATUS_UPDATE` push — status is pull (popup reads on open + subscribes to `chrome.storage.onChanged`).
- **D-06:** SW remains stateless (carries forward Phase 1 D-12 / SP-1). All counters/flags/persistence in `chrome.storage.local` or `chrome.storage.session`.
- **D-07:** `apps/extension/entrypoints/background.ts` keeps SP-7 (top-level listener registration) but body is split into typed handlers under `apps/extension/src/background/handlers/` (one file per message type), all registered synchronously at module top via `defineExtensionMessaging()`.

**Status Model (UI-04, UI-08)**
- **D-08:** Five status states: `disabled | pending | applied | error | auto-disabled` (definitions verbatim in CONTEXT.md).
- **D-09:** Source of truth is `chrome.storage`. Layout:
  - `enabled: Record<id, boolean>` (storage.local) — user intent
  - `autodisabled: Record<id, AutoDisableRecord>` (storage.local) — engine kill-switch
  - `last_error: Record<id, ErrorRecord>` (storage.local) — promoted from Phase 1's per-key shape
  - `error_window:<id>: {count, firstAt}` (storage.session) — sliding window counter
  - `applied:<tabId>: id[]` (storage.session) — per-tab applied set
- **D-10:** Status is computed in popup (NOT stored), by combining `enabled + autodisabled + last_error + applied:<activeTabId>`.

**Auto-Disable Policy (ENG-06)**
- **D-11:** Threshold: ≥3 errors in 10 seconds (sliding window). `AbortError` from cleanup NOT counted.
- **D-12:** `autodisabled:<id>` in `chrome.storage.local` (persistent); `error_window:<id>` in `chrome.storage.session` (resets on browser restart — intentional UX).
- **D-13:** Recovery: toggle OFF→ON clears `autodisabled[id]` and resets `error_window:<id>` before broadcasting `STATE_CHANGED`. NO auto-clear timer. NO separate "Re-enable" button.
- **D-14:** Visible reason in popup: red-outline badge + inline message `Disabled after {count} errors in {window}s — click toggle to re-enable.` + last error short message + click-to-expand stack.
- **D-15:** Engine never silently retries an auto-disabled experiment. Reconcile filters out any id present in `autodisabled` BEFORE deciding what to apply, regardless of `enabled` state.

**Build Artifacts (BLD-03, BLD-04)**
- **D-16:** `dist/registry.json` is emitted by extending `tools/build-experiments.ts` via `this.emitFile({type:'asset', fileName:'registry.json', source})` during `generateBundle`. Schema (see RegistryEntry below). Output: `Registry = RegistryEntry[]`.
- **D-17:** Code-split chunk strategy: continue using Phase 1's `import.meta.glob('@experiments/*/*/experiment.ts')` (NOT eager) — Vite already produces one chunk per dynamic-import target. Lock chunk file name pattern via `rollupOptions.output.chunkFileNames: 'experiments/[name]-[hash].js'`.
- **D-18:** Two sources of truth, single producer. Build plugin scans `experiments/*/*/manifest.json` once and emits both `dist/registry.json` and the chunk-path lookup. Content scripts continue using `import.meta.glob` for `() => Promise<{apply}>` loaders.
- **D-19:** Consumer wiring:
  - Popup: `fetch(chrome.runtime.getURL('registry.json'))` once on mount; re-reads on `STATE_CHANGED` only if registry changed (rare).
  - Content scripts: `fetch(chrome.runtime.getURL('registry.json'))` once on bootstrap; filter by world; match scope; load via `import.meta.glob` map keyed by `experiment.ts` path derived from `RegistryEntry.chunkPath` (or kept side-by-side in a Map).
  - SW: fetches `registry.json` lazily on first use, no caching (SW stateless — D-06).

**Popup UX with shadcn (UI-01, UI-03, UI-04, UI-08)**
- **D-20:** shadcn components in Phase 2: `Switch`, `Card`, `Collapsible`, `Badge`, `ScrollArea`, `Button`. Install via `pnpm dlx shadcn@latest add switch card collapsible badge scroll-area button` from `apps/extension/`.
- **D-21:** Popup layout (verbatim ASCII in CONTEXT.md). Author groups, count next to author, Card per experiment, Collapsible for stack trace.
- **D-22:** Author grouping: alphabetical case-insensitive; default-expanded if author owns ≥1 experiment matching active tab; collapse state NOT persisted.
- **D-23:** Status indicator → shadcn `Badge` `variant`s (`secondary` gray "Off", `outline` "Pending", `default` green "Applied", `destructive` red "Error", `destructive` outline-via-className "Auto-disabled").
- **D-24:** Toggle: shadcn `Switch`; disabled-and-spinning during in-flight SW handler. On error response, snap back + inline alert (no Toast component — keeps Phase 2 small).
- **D-25:** Error display: 1-line short message (truncate 80 chars) red text + `▶ Show stack trace` click-expands `Collapsible` with monospace stack (scroll if >10 lines). For auto-disabled: prepend the auto-disable line.
- **D-26:** Active-tab URL awareness: `chrome.tabs.query({active: true, currentWindow: true})` once on mount; tab id used to read `applied:<tabId>` from `chrome.storage.session`. Full URL is NOT used to filter rows in Phase 2 (UI-05 = Phase 3); only used to compute `pending` vs `applied`.
- **D-27:** State management: single Zustand store at `apps/extension/src/popup/store.ts` with slices for `registry`, `enabled`, `autodisabled`, `lastError`, `appliedInActiveTab`, `activeTabId`. Wires `chrome.storage.onChanged` once on init; dispatches per-key updates.

**Stable IDs & Storage Keys (MAN-03)**
- **D-28:** Every per-experiment storage key is keyed by manifest ULID. Locked key shapes (table verbatim in CONTEXT.md).
- **D-29:** Migration of Phase 1 keys: Phase 1 wrote `last_error:<id>` per-key; Phase 2 promotes to single `last_error` map under one key. Idempotent run-once at SW startup.

**SDK Surface (MAN-04)**
- **D-30:** `@platform/experiment-sdk` adds `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId(registry, id)`. Designers `import type { ExperimentStatus, ApplyFn } from '@platform/experiment-sdk'`.
- **D-31:** SDK stays zero-runtime for type-only exports; `byId` is pure ~5 lines; `Registry`/`RegistryEntry`/etc are types-only. Existing Zod runtime (`ExperimentManifest`) stays.

### Claude's Discretion
- Internal file layout under `apps/extension/src/background/handlers/`
- Exact naming of Zustand store actions
- Whether to extract a `useExperimentRow` hook or keep JSX inline
- shadcn theme tokens (default `slate` palette)
- The exact regex for URL-match in `url-match.ts` (already done in Phase 1; stable)
- Unit-test layout (Vitest, co-located `*.test.ts`)
- Whether the storage migration in D-29 runs on every SW wake or one-time idempotent
- Anything not explicitly listed in Locked Decisions

### Deferred Ideas (OUT OF SCOPE)
- 6 tweak types + auto-render (TWK-01..07) → Phase 3
- URL-filter inside popup (UI-05) → Phase 3
- Shadow DOM mount for in-page UI (UI-02) → Phase 3
- `llm()` / `fetchPage()` and options page → Phase 4
- Hot-reload, SPA navigation, drag-and-drop, search, badge counter → Phase 5
- `.crx` / GitHub Releases / fork-from-UI → Phase 6
- Options page (Phase 2 ships popup ONLY)
- Real cleanup-registry abstraction in SW (Phase 1 model — content scripts own per-tab cleanups — kept; SW remains stateless)
- Drag-and-drop ordering → Phase 5
- Tweak storage values (`tweaks:<id>`, `presets:<id>`) — Phase 2 names the convention but does not implement values
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|------------------------------------|------------------|
| ENG-04 | Engine реализует контракт `apply({tweaks, helpers, currentURL, log, signal}) → cleanup` для каждого эксперимента | D-01 (verbatim contract from SDK) + D-02 (AbortSignal honored). Compile-time TS test enforces. New file: `apps/extension/src/content/contract.test.ts`. |
| ENG-06 | Engine авто-отключает эксперимент после N ошибок за T секунд и показывает причину в popup | Sliding-window counter in `chrome.storage.session` (`error_window:<id>`); flag in `chrome.storage.local` (`autodisabled:<id>`). Reconcile filter rejects auto-disabled IDs (D-15). Threshold 3/10s (D-11). Recovery via toggle OFF→ON (D-13). Visible reason via Badge + inline message (D-14, D-25). |
| MAN-03 | Стабильный ID — генерируется ULID при первой сборке, не привязан к пути папки (rename не ломает state) | Phase 1 D-17 already stamps ULID into `manifest.json`. Phase 2 D-28 promotes ULID to be the storage-key root for ALL per-experiment keys. Folder rename does not change ULID, therefore no key breaks. |
| MAN-04 | TS-типы `ExperimentManifest`, `ApplyArgs`, `Helpers` экспортируются из общего пакета | Phase 1 already exports `ExperimentManifest`, `ApplyArgs`, `ApplyFn`, `CleanupFn`, `Helpers`. Phase 2 D-30 adds `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId`. Designers `import type` for autocomplete. |
| BLD-03 | Сборка генерирует артефакт `dist/registry.json` с агрегированным списком экспериментов | D-16 — `tools/build-experiments.ts` extended with `generateBundle` hook calling `this.emitFile({type:'asset', fileName:'registry.json', source})`. Schema: `RegistryEntry[]`. |
| BLD-04 | Каждый эксперимент бандлится в отдельный code-split chunk | D-17 — non-eager `import.meta.glob` already produces per-experiment chunks; pin via `rollupOptions.output.chunkFileNames: 'experiments/[name]-[hash].js'`. Capture chunk paths in `generateBundle` (when bundle is finalized) and write into corresponding `RegistryEntry.chunkPath`. Phase 1's smoke is currently inlined into `content-isolated.js` (Vite collapses single dynamic-import targets); this changes once a second experiment lands or once we force `manualChunks` (see §4 below). |
| UI-01 | UI плагина построен на shadcn/ui (React 19 + Tailwind CSS v4) для popup и options page | shadcn install via `pnpm dlx shadcn@latest init` + `add switch card collapsible badge scroll-area button` (D-20). Tailwind v4 already wired in Phase 1 (`@import "tailwindcss";` in `apps/extension/src/styles/popup.css`). React 19 already installed. **Options page is OUT of scope (Phase 4)** — Phase 2 ships popup only per CONTEXT `<deferred>`. |
| UI-03 | Popup показывает список экспериментов, сгруппированных по автору | D-21 (layout) + D-22 (sort, count, expand-default behavior). Group via `Map<author, RegistryEntry[]>`; render with `Collapsible` per author. |
| UI-04 | Каждый эксперимент в popup имеет toggle (вкл/выкл), индикатор статуса (применён / ошибка / отключён) | shadcn `Switch` + `Badge`. Five status states (D-08, D-23). Toggle dispatches `EXPERIMENT_TOGGLE` via `@webext-core/messaging` (D-24). |
| UI-08 | Ошибки экспериментов показываются в popup per-эксперимент (краткое сообщение + раскрытый стектрейс по клику) | D-25 — short message visible, click-expand `Collapsible` for full stack. `last_error[id]` read from `chrome.storage.local`. For `auto-disabled`, prepend the auto-disable line (count + window). |

**Coverage:** All 10 phase requirements addressed by D-decisions; the specifics below operationalize each.
</phase_requirements>

---

## 1. Executive Summary

Phase 2 turns the Phase 1 skeleton (loadable extension, two-world content scripts, ULID-stamped smoke, top-level listener, stateless storage, build-time discovery, CSP guardrail) into a **usable shell**: typed messaging bus, SW orchestrator with auto-disable, popup with author grouping + per-experiment toggle/status/error display, `dist/registry.json` artifact, and per-experiment code-split chunks. All 31 user decisions are locked. This research concretizes the *implementation specifics* the planner needs: exact `@webext-core/messaging` API and SP-7 interaction, shadcn CLI behavior in a WXT subpackage, Vite plugin `generateBundle` shape for emitting `registry.json` with finalized chunk paths, `chrome.storage.session` quotas + listener semantics + `setAccessLevel` rule, Zustand 5 slice composition, sliding-window math, and Vitest mock extensions.

**Confidence per claim group:**
- `@webext-core/messaging` API & SP-7 ordering: **HIGH** — `onMessage()` is documented as a synchronous module-top call returning the same `chrome.runtime.onMessage.addListener` shape; the SP-7 invariant is preserved if we keep `onMessage(...)` calls outside `defineBackground()`. Verified via `webext-core.aklinker1.io/messaging`. [CITED: webext-core.aklinker1.io/messaging/installation, /protocol-maps]
- shadcn/ui CLI in a WXT subpackage: **MEDIUM-HIGH** — official Vite recipe documents `pnpm dlx shadcn@latest init -t vite`, `components.json` with `@/*` aliases mapped to `apps/extension/src/*`, and Tailwind v4 single-line `@import "tailwindcss";`. The "monorepo subpackage" wrinkle (R3) is not explicitly documented but the canonical shadcn `aliases.components: "@/components"` resolves correctly because Phase 1 already wired the `@/` alias in `wxt.config.ts:31` and `tsconfig.json`. [CITED: ui.shadcn.com/docs/installation/vite, ui.shadcn.com/docs/installation/manual]
- Vite/Rollup chunk-naming + `generateBundle`: **HIGH** — `output.chunkFileNames` accepts `[name]-[hash].js` template and a function form `(PreRenderedChunk) => string` with access to `facadeModuleId, isDynamicEntry, isEntry, moduleIds, name`; `this.emitFile({type:'asset', fileName, source})` is the Rollup-stable API. Chunk-path lookup uses `bundle[fileName].facadeModuleId` in the `generateBundle` hook to map source `experiment.ts` paths → emitted chunk filenames. [CITED: rollupjs.org/configuration-options/#output-chunkfilenames, rollupjs.org/plugin-development]
- `chrome.storage.session` quotas + listener: **HIGH** — 10 MB quota; `onChanged` fires with second `areaName` arg = `'session'`; SW termination preserves session storage (it lives in browser process, not SW); browser restart wipes it. **CRITICAL caveat: by default `chrome.storage.session` is NOT exposed to content scripts; we MUST call `chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})` from the SW so content scripts can write `applied:<tabId>`.** [CITED: developer.chrome.com/docs/extensions/reference/api/storage]
- `web_accessible_resources` for `registry.json`: **HIGH** — Chrome docs explicitly state "Content scripts themselves do not need to be allowed" and popup runs at extension origin; **NO** `web_accessible_resources` declaration is required for either popup or content-script `fetch(chrome.runtime.getURL('registry.json'))` calls. Saves us a manifest entry and removes R4. [CITED: developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources]
- Zustand 5 + storage subscription: **HIGH** — `create<RootState>()((...a) => ({...sliceA(...a), ...sliceB(...a)}))` is the canonical TS slice pattern. `useStore.subscribe(selector, listener)` for cross-component subscriptions; `useStore.setState(partial)` from outside React (e.g., from a `chrome.storage.onChanged` listener registered once in `popup/main.tsx`).

**Primary recommendation:** The planner should organize Phase 2 work into 6 waves: (W0) test infrastructure + sdk type extensions + storage helpers + idempotent migration; (W1) `@webext-core/messaging` protocol + SW handler split + auto-disable policy; (W2) `tools/build-experiments.ts` extension for `registry.json` + chunk-path capture + chunk-name pinning; (W3) shadcn install + popup shell with Zustand store + `chrome.storage.onChanged` subscription; (W4) content-script reconcile pipeline that reports `EXPERIMENT_ERROR` and writes `applied:<tabId>` to `chrome.storage.session`; (W5) live MV3 smoke checklist + manual UAT.

---

## 2. Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Typed messaging bus | Service Worker | Popup, Content Scripts | SW is the only durable hub between popup and tabs; `onMessage` listeners must register at module top (SP-7). |
| Apply/cleanup orchestration | Content Script (per tab) | — | Phase 1 D-12 keeps cleanups in content-script `Map<id, CleanupFn>`. SW remains stateless. Phase 2 keeps this — only the *reporting* (EXPERIMENT_ERROR) goes via SW. |
| Error window counting | Service Worker | Storage (storage.session) | Multiple tabs can fire EXPERIMENT_ERROR for the same id; SW is the natural single-writer. Persistence in storage.session, not SW memory (SP-1). |
| Auto-disable kill-switch | Service Worker | Storage (storage.local) | Persistent across browser restart per D-12. SW writes; content scripts read on next reconcile via storage.local. |
| Per-tab applied set | Content Script | Storage (storage.session) | Only the content script in tab N knows what is currently applied in tab N. Writes after every reconcile completion. Popup reads `applied:<activeTabId>` on open. |
| Status computation | Popup | Storage (storage.local + storage.session) | Status is derived from `enabled + autodisabled + last_error + applied:<activeTabId>`. Popup is the sole reader; no derived-state in storage. |
| Registry metadata | Build artifact (`dist/registry.json`) | Popup, Content Scripts, SW | Build-time `import.meta.glob` discovers manifests; build plugin emits aggregated JSON; runtime consumers fetch via `chrome.runtime.getURL`. |
| Per-experiment chunk loading | Content Script | Vite/Rollup | Vite's non-eager `import.meta.glob` produces one chunk per dynamic-import target. `chunkFileNames` pins the file pattern. Content script imports lazily. |
| Popup state | Popup (Zustand store) | Storage (subscribed via `chrome.storage.onChanged`) | Storage is source of truth (D-09); store mirrors it for React rendering. |

---

## 3. `@webext-core/messaging` Integration

### API surface (verified)

`@webext-core/messaging` exports `defineExtensionMessaging<ProtocolMap>()` returning `{sendMessage, onMessage}`. ProtocolMap is a TS interface declaring each message as a method:

```ts
// Verbatim shape from webext-core docs [CITED: webext-core.aklinker1.io/messaging/protocol-maps]
interface ProtocolMap {
  message1(): void;                // No data and no return type
  message2(data: string): void;    // Only data
  message3(): boolean;             // Only a return type
  message4(data: string): boolean; // Data and return type
}
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

### Phase 2 ProtocolMap (D-05 operationalized)

```ts
// apps/extension/src/shared/messages.ts (REPLACES Phase 1's tag union)
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
  STATE_CHANGED(): void;                     // broadcast — no payload, no response
  EXPERIMENT_ERROR(data: ErrorReport): { ok: true };
  STATUS_QUERY(): Record<string, ExperimentStatus>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
```

The Phase 1 `isExtensionMessage(value: unknown)` type guard goes away — `@webext-core/messaging` handles the runtime tag decoding internally.

### SP-7 interaction (R1 — RESOLVED)

**Question:** Does `onMessage()` register listeners synchronously at module import time, so calls placed at the top of `apps/extension/entrypoints/background.ts` survive SW idle termination per Pitfall 1?

**Answer:** YES. `@webext-core/messaging`'s `onMessage(name, handler)` calls `chrome.runtime.onMessage.addListener` internally; calling `onMessage(...)` at module top (before `defineBackground()`) preserves the SP-7 invariant verified in Phase 1 (`background.ts:20 < 53`). The library is maintained by the WXT author (`@aklinker1`) and explicitly designed for MV3 SWs. [CITED: webext-core.aklinker1.io/messaging/installation]

**Concrete pattern for `apps/extension/entrypoints/background.ts` (Phase 2 shape):**

```ts
import { defineBackground } from 'wxt/utils/define-background';
import { onMessage } from '@/shared/messages';
import { handleExperimentToggle } from '@/background/handlers/experiment-toggle';
import { handleExperimentError } from '@/background/handlers/experiment-error';
import { runStartupMigration } from '@/shared/storage';

// ===== TOP-LEVEL LISTENERS (SP-7) =====
// Register synchronously, before any await, before defineBackground.
onMessage('EXPERIMENT_TOGGLE', ({ data }) => handleExperimentToggle(data));
onMessage('EXPERIMENT_ERROR', ({ data }) => handleExperimentError(data));
// Note: STATE_CHANGED is broadcast-only (SW → tabs); SW does not handle it.
// Note: STATUS_QUERY is content-script-handled (popup → active content script).

// One-time idempotent migration (D-29). Runs on every SW wake; no-op after first.
// Wrapped in catch — never throw at top level.
void runStartupMigration().catch((err) => console.error('[bg] migration failed', err));

// ===== WXT-DEFINED MAIN (kept near-empty per SP-7) =====
export default defineBackground(() => {
  // Intentionally empty. State lives in chrome.storage.{local,session}.
  // chrome.storage.session.setAccessLevel runs here because it's not a listener
  // and doesn't need top-level placement; first wake calls it; subsequent wakes
  // re-call it — Chrome treats repeat calls as idempotent (no-op if already set).
  void chrome.storage.session
    .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch((err) => console.error('[bg] setAccessLevel failed', err));
});
```

**`apps/extension/src/background/handlers/experiment-toggle.ts` (D-07 split):**

```ts
import type { ProtocolMap } from '@/shared/messages';
import { sendMessage } from '@/shared/messages';
import {
  clearAutoDisable,
  clearErrorWindow,
  setEnabledExperiment,
} from '@/shared/storage';

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
    // Broadcast STATE_CHANGED to every tab. Per-tab errors (no content script)
    // are suppressed in the helper.
    await broadcastStateChanged();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function broadcastStateChanged(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await sendMessage('STATE_CHANGED', undefined, tab.id);
      } catch {
        // tab has no content script — expected
      }
    }),
  );
}
```

### Why `@webext-core/messaging` over Phase 1's tag union

- Eliminates `unknown`-cast boilerplate (Phase 1's `isExtensionMessage` runtime guard).
- Provides typed payloads end-to-end (TS infers `data` and return type per message).
- Same maintainer as WXT (`@aklinker1`); guaranteed compat.
- Phase 1's `apps/extension/src/shared/messages.ts` already explicitly predicted this move in a doc-comment.

---

## 4. shadcn/ui + Tailwind v4 + React 19 inside WXT 0.20

### Pre-flight state (Phase 1 already done)

- `tailwindcss ^4.2.4` and `@tailwindcss/vite ^4.2.4` are pinned in `apps/extension/package.json:23,28`.
- `apps/extension/wxt.config.ts:25` registers `tailwindcss()` Vite plugin — no PostCSS config needed (Tailwind v4 uses the Vite plugin directly).
- `apps/extension/src/styles/popup.css` contains `@import "tailwindcss";` (single-line v4 syntax).
- `apps/extension/wxt.config.ts:31` declares `'@/'` alias → `apps/extension/src/`.
- `tsconfig.json` (root) references the extension package; the extension's own tsconfig must declare `paths: { "@/*": ["./src/*"] }` so the editor + `tsc --noEmit` resolve `@/components/ui/switch` etc.

### CLI invocation (verbatim from D-20)

From `apps/extension/`:

```bash
# 1) Initialize shadcn (creates components.json + lib/utils.ts + adds clsx + tailwind-merge + class-variance-authority + lucide-react + tw-animate-css if not present).
pnpm dlx shadcn@latest init

# 2) Add the six Phase 2 components.
pnpm dlx shadcn@latest add switch card collapsible badge scroll-area button
```

[CITED: ui.shadcn.com/docs/installation/vite] confirms the v4 + Vite recipe is `pnpm dlx shadcn@latest init -t vite` followed by `add` calls. Tailwind v4 setup is the single-line `@import "tailwindcss";` (already present in Phase 1).

### Expected `components.json` output

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

The `@/*` alias resolves to `apps/extension/src/*` per `wxt.config.ts:31` (Vite runtime) AND must be declared in `apps/extension/tsconfig.json` `compilerOptions.paths` (TS editor). [CITED: ui.shadcn.com/docs/installation/vite — "TypeScript Path Aliases" section]

### Resulting file layout (after install + `add`)

```
apps/extension/src/
├── components/
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── collapsible.tsx
│       ├── scroll-area.tsx
│       └── switch.tsx
├── lib/
│   └── utils.ts          # exports cn(...inputs: ClassValue[]) — clsx + tailwind-merge
└── styles/
    └── popup.css         # already has @import "tailwindcss";
```

The shadcn CLI will modify `apps/extension/src/styles/popup.css` to also include the shadcn theme variables block (`@theme inline { --background: ... }` etc.) and `@plugin "tw-animate-css";`. Expect the file to grow from 1 line to ~80-120 lines.

### New deps added by shadcn init

- `clsx` (already pinned in Phase 1 RESEARCH but not in package.json — shadcn `init` will add it as a dep)
- `tailwind-merge` (same)
- `class-variance-authority` (new; used by Badge variants and Button variants)
- `lucide-react` (new; icons)
- `tw-animate-css` (new; replaces `tailwindcss-animate` for Tailwind v4)
- `@radix-ui/react-switch`, `@radix-ui/react-collapsible`, `@radix-ui/react-scroll-area` (transitive when each component is `add`ed)

### R3 — shadcn-CLI in a WXT subpackage of a pnpm monorepo

**Question:** Does `pnpm dlx shadcn@latest init` work cleanly inside `apps/extension/` (a WXT subpackage in a pnpm monorepo)? Does path resolution for `aliases.components` / `aliases.ui` work?

**Answer (MEDIUM-HIGH):** Yes, with one caveat. The CLI runs in CWD and writes `components.json` next to the nearest `package.json`. Because Phase 1 already wired `'@/'` → `apps/extension/src/` in BOTH `wxt.config.ts:31` (Vite) AND `tsconfig.json` (TS), the `@/components/ui/...` imports will resolve at runtime AND at typecheck time. The wrinkle is that the CLI needs `tsconfig.json` `paths` to be present in `apps/extension/tsconfig.json` (NOT just the root tsconfig). **Verify this in Wave 0 by running the init command and inspecting `apps/extension/tsconfig.json` after-state.** If `paths` is absent, add:

```jsonc
// apps/extension/tsconfig.json (additive)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

The shadcn `init` command may add this automatically; verify by diffing `apps/extension/tsconfig.json` before/after.

### Tailwind v4 + WXT compat (R-resolved)

Tailwind v4's `@tailwindcss/vite` plugin is **already wired** in `wxt.config.ts:25`. No PostCSS config exists, none is needed. The shadcn CLI's `init` will only modify `apps/extension/src/styles/popup.css` (add `@theme inline { ... }` variables + `@plugin "tw-animate-css";`); it should NOT add a `postcss.config.js` for v4.

### React 19 compat (R-resolved)

shadcn/ui has supported React 19 since 2025-01 (CLI version 4.x). All Phase 2 components (Switch, Card, Collapsible, Badge, ScrollArea, Button) are React-19-clean. `@types/react ^19.0.0` and `@types/react-dom ^19.0.0` are already in `apps/extension/package.json:25-26`.

---

## 5. Vite Rollup chunk-naming + `generateBundle` for `registry.json`

### Current state (Phase 1)

- `tools/build-experiments.ts` is a Vite plugin with a single `buildStart` hook that scans `experiments/*/*/manifest.json`, ULID-stamps, validates with Zod, enforces author-vs-folder.
- It does NOT currently emit anything.
- Phase 1 build inlines the smoke into `content-scripts/content-isolated.js` (verified — `apps/extension/.output/chrome-mv3/chunks/` contains only `popup-D37i6H7o.js`; the smoke's CSS string `background: pink` is inside `content-isolated.js`). Vite collapsed the dynamic-import target because there's exactly one experiment and it's a tiny module.

### What Phase 2 needs

1. **`registry.json` emission** at `apps/extension/.output/chrome-mv3/registry.json`.
2. **Per-experiment chunks** — one chunk file per experiment, even when there's only one. This is BLD-04. Without forcing it, Phase 1's "inline collapse" will continue and `chunkPath` will be wrong.
3. **`chunkPath` discovery** — the plugin must know the *finalized* chunk filename for each experiment to write into `registry.json`. Filenames are only known *after* Rollup's chunk-naming pass, which means the work must run in `generateBundle`, not `buildStart`.

### Rollup `chunkFileNames` + `manualChunks` shape

[CITED: rollupjs.org/configuration-options/#output-chunkfilenames]

`chunkFileNames` accepts:
- A string template: `'experiments/[name]-[hash].js'` (`[name]`, `[hash]`, `[format]`; forward slashes for subdirs).
- A function `(chunkInfo: PreRenderedChunk) => string`. `PreRenderedChunk` exposes `facadeModuleId`, `isDynamicEntry`, `isEntry`, `moduleIds`, `name`, `type`.

`manualChunks` (when we want to *force* one chunk per experiment even for a single experiment):
- Function form: `(id: string, {getModuleInfo, getModuleIds}) => string | undefined`. Returning a string assigns `id` to that chunk name. Returning `undefined` lets Rollup decide.

### Recommended approach (D-17 operationalized)

**Option A (preferred — minimal):** Pin `chunkFileNames` only; rely on Vite's default-per-dynamic-import behavior. As soon as a 2nd experiment exists, Vite emits two chunks. For Phase 1's single-experiment edge case, the smoke remains inlined into `content-isolated.js` AND we still emit `registry.json` with `chunkPath: ''` (empty string sentinel) — content scripts treat empty `chunkPath` as "loaded statically, no separate chunk" and use the `import.meta.glob` loader directly without resolving a chunk URL. This is D-19's "kept side-by-side in a Map" model.

**Option B (force always):** Use `manualChunks` function form to put every `experiments/*/*/experiment.ts` module into its own chunk by ULID:

```ts
manualChunks(id, { getModuleInfo }) {
  // id is the resolved absolute path
  const m = id.match(/[/\\]experiments[/\\]([^/\\]+)[/\\]([^/\\]+)[/\\]experiment\.ts$/);
  if (!m) return undefined;
  const [, author, folder] = m;
  return `experiments/${author}-${folder}`;  // chunk name; chunkFileNames adds [hash]
}
```

This guarantees one chunk per experiment regardless of how many experiments exist. **Recommendation: Option B.** BLD-04 says "каждый эксперимент бандлится в отдельный code-split chunk" — that's a contract, not an optimization, so we should not depend on Vite's heuristic.

### The Vite plugin extension shape (D-16 + D-18 operationalized)

```ts
// tools/build-experiments.ts — PHASE 2 ADDITIONS (additive to Phase 1's plugin)
import type { Plugin, NormalizedOutputOptions, OutputBundle } from 'vite';
// ... existing Phase 1 imports + scanAndValidate + authorFromPath + formatErrors ...

export type RegistryEntry = {
  id: string;
  author: string;
  name: string;
  description: string;
  scope: { match: string[]; regex?: string[] };
  world: 'isolated' | 'main';
  chunkPath: string;       // relative to extension root, e.g. "chunks/experiments-andrew-smoke-DkJ7g.js" or '' if inlined
  tweaks: unknown[];
};

export function buildExperiments(options: BuildExperimentsOptions = {}): Plugin {
  const root = options.root ?? process.cwd();

  // Cached scan result — populated in buildStart, consumed in generateBundle.
  let scan: ScanResult | null = null;

  return {
    name: 'platform:build-experiments',

    buildStart() {
      scan = scanAndValidate(root);
      if (scan.errors.length > 0) throw new Error(formatErrors(scan.errors));
    },

    // generateBundle runs AFTER Rollup has named all chunks; bundle[fileName].facadeModuleId
    // tells us which source module each chunk represents.
    generateBundle(_options: NormalizedOutputOptions, bundle: OutputBundle) {
      if (!scan) return;

      // Build a lookup from absolute experiment.ts path → emitted chunk filename.
      const chunkByExperimentPath = new Map<string, string>();
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'chunk') continue;
        const facade = asset.facadeModuleId; // string | null
        if (!facade) continue;
        if (/[/\\]experiments[/\\][^/\\]+[/\\][^/\\]+[/\\]experiment\.ts$/.test(facade)) {
          chunkByExperimentPath.set(facade, fileName);
        }
      }

      const registry: RegistryEntry[] = scan.manifests.map(({ path, data }) => {
        const absExperimentTs = resolve(root, dirname(path), 'experiment.ts');
        const chunkPath = chunkByExperimentPath.get(absExperimentTs) ?? '';
        return {
          id: data.id,
          author: data.author,
          name: data.name,
          description: data.description,
          scope: data.scope,
          world: data.world,
          chunkPath,
          tweaks: data.tweaks,
        };
      });

      this.emitFile({
        type: 'asset',
        fileName: 'registry.json',
        source: `${JSON.stringify(registry, null, 2)}\n`,  // SP-3: idempotent JSON shape
      });
    },
  };
}
```

[CITED: rollupjs.org/plugin-development] confirms the `generateBundle(options, bundle)` signature; `bundle` is keyed by output filename, and chunk entries expose `.facadeModuleId` (the source module that became this chunk's facade).

### `wxt.config.ts` additions (D-17)

```ts
// apps/extension/wxt.config.ts (PHASE 2 ADDITIONS — additive to Phase 1)
vite: () => ({
  plugins: [tailwindcss(), buildExperiments({ root: repoRoot })],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',  // pin pattern (D-17)
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
    alias: { '@/': `${resolve(__dirname, 'src')}/`, '@experiments': resolve(repoRoot, 'experiments') },
  },
}),
```

### R5 — chunk path consistency

**Question:** Vite's per-chunk file names depend on dynamic-import call sites; the `chunkPath` written to `registry.json` must match the actual emitted file name.

**Answer (RESOLVED):** Using `manualChunks` to force one chunk per experiment (named `experiments-<author>-<folder>`) guarantees the chunk's `name` = `experiments-andrew-smoke`, and `chunkFileNames: 'chunks/[name]-[hash].js'` produces e.g. `chunks/experiments-andrew-smoke-DkJ7g.js`. The `generateBundle` lookup uses `facadeModuleId` (the exact source path), which is stable across builds. **Caveat (R5a):** if a content script imports the experiment module via `import.meta.glob('@experiments/*/*/experiment.ts')` lazily AND the popup separately fetches `registry.json`, both consumers see the *same* chunk URL because Vite emits one canonical file. Confirmed by reading [CITED: rollupjs.org/configuration-options/#output-manualchunks] — manual chunks are deduplicated globally.

### R4 — WXT WAR collision (RESOLVED)

**Question:** WXT may inject its own `web_accessible_resources` for HMR; emitting `registry.json` must not collide.

**Answer (RESOLVED):** No collision. Per the Chrome docs [CITED: developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources]: "Content scripts themselves do not need to be allowed" and popups run at extension origin. `fetch(chrome.runtime.getURL('registry.json'))` from either context does NOT require a `web_accessible_resources` declaration. WXT's auto-injected WAR (used for HMR) is unrelated. **No manifest changes needed in `wxt.config.ts`** for `registry.json` access. This removes the speculative `web_accessible_resources` block in CONTEXT.md `<code_context>` line 260.

---

## 6. Web-Accessible-Resources for `registry.json` (manifest fragment)

**No declaration needed.** Per the Chrome MV3 spec [CITED: developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources]:

> "A navigation from a web origin to an extension resource is blocked unless the resource is listed as web accessible. **Content scripts themselves do not need to be allowed.**"

- **Popup:** runs at extension origin; can `fetch(chrome.runtime.getURL('registry.json'))` directly.
- **Isolated-world content script:** runs at chrome-extension:// origin via `chrome.runtime.getURL`; the `fetch` call is from extension context, not the page. Chrome allows this without a WAR declaration.
- **MAIN-world content script:** would need WAR (because MAIN runs at page origin), but Phase 2 has no MAIN-world code that reads `registry.json` — the MAIN-world content script (`content-main.content.ts`) imports the registry via the SAME `import.meta.glob` call as Phase 1, NOT via `fetch`. Phase 2's only MAIN-world reader is the (still empty) MAIN-world content script's bootstrap, and it stays import-based.

**No manifest fragment required.**

If a Phase 3+ requirement ever lands MAIN-world code that fetches `registry.json`, the addition is:

```ts
// apps/extension/wxt.config.ts (HYPOTHETICAL — not needed in Phase 2)
manifest: {
  web_accessible_resources: [
    { resources: ['registry.json'], matches: ['*://*.ya.ru/*', '*://ya.ru/*'] },
  ],
}
```

---

## 7. Storage Extensions (`chrome.storage.session`, onChanged, migration)

### `chrome.storage.session` quotas + listener semantics [CITED: developer.chrome.com/docs/extensions/reference/api/storage]

- **Quota:** 10,485,760 bytes (10 MB) — ample for `error_window:<id>` (small object) and `applied:<tabId>` (small string array). At ~50 ULIDs (26 chars each = 27 bytes including comma) per tab, an extreme tab count of 100 = 270 KB, well under the limit.
- **Persistence:** session storage is in-memory in the browser process (NOT in the SW). It survives SW termination. It is wiped on browser restart, extension reload, extension update, extension disable.
- **Why this matches D-12 / D-13:** sliding-window error counts SHOULD reset on browser restart (intentional UX — "errors from yesterday don't haunt the user"). Auto-disable flag must persist across browser restart (storage.local).
- **`onChanged` listener:** `chrome.storage.onChanged.addListener((changes, areaName) => ...)` fires for both `local` and `session` areas. The second arg is the literal string `'local' | 'session' | 'managed' | 'sync'`. The popup's Zustand subscription must inspect `areaName` to route the change to the right slice.

### `setAccessLevel` for content-script writes (R6 — CRITICAL caveat)

**By default, `chrome.storage.session` is NOT exposed to content scripts** [CITED: developer.chrome.com/docs/extensions/reference/api/storage]. Content scripts trying to `chrome.storage.session.set({...})` will throw `Error: Access to storage.session denied`.

D-09 / D-28 requires content scripts to write `applied:<tabId>` to `chrome.storage.session`. Therefore the SW MUST call (once on startup, idempotent on subsequent wakes):

```ts
// apps/extension/entrypoints/background.ts (inside defineBackground main, OR top-level)
await chrome.storage.session.setAccessLevel({
  accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
});
```

The two valid `accessLevel` values are `'TRUSTED_CONTEXTS'` (default; SW + popup + options only) and `'TRUSTED_AND_UNTRUSTED_CONTEXTS'` (also content scripts). After the call, content scripts have full read+write access to `chrome.storage.session`.

**Idempotency:** calling `setAccessLevel` repeatedly is harmless — the API just sets a flag. We can call it from inside `defineBackground` `main()` on every SW wake.

### New helpers in `apps/extension/src/shared/storage.ts` (D-09 + D-28 + D-29)

```ts
// PHASE 2 ADDITIONS — extends Phase 1 storage.ts. Phase 1 helpers stay.
import type { AutoDisableRecord, ErrorRecord } from '@platform/experiment-sdk';

const KEY_AUTODISABLED = 'autodisabled';
const KEY_LAST_ERROR = 'last_error';
const ERR_WINDOW_PREFIX = 'error_window:';
const APPLIED_PREFIX = 'applied:';
const PHASE1_LAST_ERROR_PREFIX = 'last_error:';

// ----- enabled (Phase 1) — unchanged -----
// ----- last_error map (Phase 2 promotion of Phase 1 per-key shape, D-29) -----

export async function getLastErrors(): Promise<Record<string, ErrorRecord>> {
  const r = await chrome.storage.local.get(KEY_LAST_ERROR);
  return (r[KEY_LAST_ERROR] as Record<string, ErrorRecord> | undefined) ?? {};
}

export async function setLastError(id: string, error: ErrorRecord): Promise<void> {
  const map = await getLastErrors();
  map[id] = error;
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

export async function clearLastError(id: string): Promise<void> {
  const map = await getLastErrors();
  delete map[id];
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
}

// ----- autodisabled map -----

export async function getAutoDisabled(): Promise<Record<string, AutoDisableRecord>> {
  const r = await chrome.storage.local.get(KEY_AUTODISABLED);
  return (r[KEY_AUTODISABLED] as Record<string, AutoDisableRecord> | undefined) ?? {};
}

export async function setAutoDisable(id: string, record: AutoDisableRecord): Promise<void> {
  const map = await getAutoDisabled();
  map[id] = record;
  await chrome.storage.local.set({ [KEY_AUTODISABLED]: map });
}

export async function clearAutoDisable(id: string): Promise<void> {
  const map = await getAutoDisabled();
  delete map[id];
  await chrome.storage.local.set({ [KEY_AUTODISABLED]: map });
}

// ----- error_window:<id> in storage.session (sliding window) -----

export type ErrorWindow = { count: number; firstAt: number };

export async function getErrorWindow(id: string): Promise<ErrorWindow | undefined> {
  const key = `${ERR_WINDOW_PREFIX}${id}`;
  const r = await chrome.storage.session.get(key);
  return r[key] as ErrorWindow | undefined;
}

export async function setErrorWindow(id: string, w: ErrorWindow): Promise<void> {
  await chrome.storage.session.set({ [`${ERR_WINDOW_PREFIX}${id}`]: w });
}

export async function clearErrorWindow(id: string): Promise<void> {
  await chrome.storage.session.remove(`${ERR_WINDOW_PREFIX}${id}`);
}

// ----- applied:<tabId> in storage.session -----

export async function getAppliedInTab(tabId: number): Promise<string[]> {
  const key = `${APPLIED_PREFIX}${tabId}`;
  const r = await chrome.storage.session.get(key);
  return (r[key] as string[] | undefined) ?? [];
}

export async function setAppliedInTab(tabId: number, ids: string[]): Promise<void> {
  await chrome.storage.session.set({ [`${APPLIED_PREFIX}${tabId}`]: ids });
}

// ----- D-29 idempotent migration -----

const MIGRATION_KEY = '_migrations';
const MIGRATION_NAME = 'last_error_to_map_v1';

export async function runStartupMigration(): Promise<void> {
  const r = await chrome.storage.local.get(MIGRATION_KEY);
  const done = (r[MIGRATION_KEY] as string[] | undefined) ?? [];
  if (done.includes(MIGRATION_NAME)) return; // idempotent

  // Find all `last_error:<ulid>` keys.
  const all = await chrome.storage.local.get(null);
  const oldKeys = Object.keys(all).filter((k) => k.startsWith(PHASE1_LAST_ERROR_PREFIX));
  if (oldKeys.length === 0) {
    // Nothing to migrate; still mark done so we don't scan again.
    await chrome.storage.local.set({ [MIGRATION_KEY]: [...done, MIGRATION_NAME] });
    return;
  }

  const map: Record<string, ErrorRecord> = {};
  for (const k of oldKeys) {
    const id = k.slice(PHASE1_LAST_ERROR_PREFIX.length);
    const value = all[k];
    // Phase 1 stored String(err); promote to ErrorRecord shape.
    map[id] = {
      phase: 'apply',
      message: typeof value === 'string' ? value : String(value),
      at: Date.now(),
    };
  }
  await chrome.storage.local.set({ [KEY_LAST_ERROR]: map });
  await chrome.storage.local.remove(oldKeys);
  await chrome.storage.local.set({ [MIGRATION_KEY]: [...done, MIGRATION_NAME] });
}
```

### R7 — migration idempotency under multiple SW wake-ups (RESOLVED)

**Concern:** SW can wake and re-import the module many times. The migration must run exactly once.

**Mitigation:** the `_migrations` array key in `chrome.storage.local` is the idempotency record. After the first successful migration, the key contains `['last_error_to_map_v1']`. Every subsequent wake reads the key, sees the migration name, and exits early. The migration itself is also idempotent (no-op if no `last_error:*` keys remain, AND it overwrites the consolidated `last_error` map only with what it finds — if Phase 2 code has already written new entries to the map, the migration would clobber them).

**Edge case:** if Phase 1 wrote `last_error:<id>` AND Phase 2 starts writing to the new `last_error` map BEFORE the migration runs, the migration's `chrome.storage.local.set({last_error: map})` would overwrite Phase 2's writes. **Mitigation:** the migration MUST run BEFORE any other code that reads/writes `last_error`. The handler imports above call `getLastErrors()`/`setLastError()`/`clearLastError()` which read the new key. The migration is invoked at the **top** of `background.ts` (before any handler is registered, in the same module-load tick — handlers are registered first; `runStartupMigration()` is called second, but `void` so it doesn't block). **Recommendation:** run `runStartupMigration()` BEFORE the `onMessage(...)` registrations (move it above), so the first tick of the SW always migrates first. Acceptable: the listener is still registered synchronously before any await.

---

## 8. Zustand Store Shape + `chrome.storage.onChanged` Subscription

### Slice composition (D-27 operationalized)

[CITED: deepwiki.com/pmndrs/zustand/7.1-slices-pattern; webext-core docs] confirm the canonical Zustand 5 + TS pattern:

```ts
// apps/extension/src/popup/store.ts
import { create, type StateCreator } from 'zustand';
import type {
  AutoDisableRecord,
  ErrorRecord,
  Registry,
} from '@platform/experiment-sdk';

// ----- Slice 1: Registry -----
type RegistrySlice = {
  registry: Registry;
  setRegistry: (r: Registry) => void;
};
const registrySlice: StateCreator<RootState, [], [], RegistrySlice> = (set) => ({
  registry: [],
  setRegistry: (r) => set({ registry: r }),
});

// ----- Slice 2: Storage-mirrored state -----
type StorageSlice = {
  enabled: Record<string, boolean>;
  autodisabled: Record<string, AutoDisableRecord>;
  lastError: Record<string, ErrorRecord>;
  setEnabled: (e: Record<string, boolean>) => void;
  setAutoDisabled: (a: Record<string, AutoDisableRecord>) => void;
  setLastError: (m: Record<string, ErrorRecord>) => void;
};
const storageSlice: StateCreator<RootState, [], [], StorageSlice> = (set) => ({
  enabled: {},
  autodisabled: {},
  lastError: {},
  setEnabled: (e) => set({ enabled: e }),
  setAutoDisabled: (a) => set({ autodisabled: a }),
  setLastError: (m) => set({ lastError: m }),
});

// ----- Slice 3: Active tab + applied set -----
type TabSlice = {
  activeTabId: number | null;
  appliedInActiveTab: string[];
  setActiveTab: (id: number | null) => void;
  setAppliedInActiveTab: (ids: string[]) => void;
};
const tabSlice: StateCreator<RootState, [], [], TabSlice> = (set) => ({
  activeTabId: null,
  appliedInActiveTab: [],
  setActiveTab: (id) => set({ activeTabId: id }),
  setAppliedInActiveTab: (ids) => set({ appliedInActiveTab: ids }),
});

// ----- Root composition -----
type RootState = RegistrySlice & StorageSlice & TabSlice;

export const useStore = create<RootState>()((...a) => ({
  ...registrySlice(...a),
  ...storageSlice(...a),
  ...tabSlice(...a),
}));
```

### Wiring `chrome.storage.onChanged` — once on popup mount (D-27)

```ts
// apps/extension/entrypoints/popup/main.tsx (PHASE 2 — replaces Phase 1 mount)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/popup.css';
import { App } from './App';
import { useStore } from '@/popup/store';
import {
  getEnabledExperiments,
  getAutoDisabled,
  getLastErrors,
  getAppliedInTab,
} from '@/shared/storage';

// ===== One-time setup BEFORE React mount =====

async function bootstrapStore(): Promise<void> {
  const [enabled, autodisabled, lastError, registryRes] = await Promise.all([
    getEnabledExperiments(),
    getAutoDisabled(),
    getLastErrors(),
    fetch(chrome.runtime.getURL('registry.json')).then((r) => r.json()),
  ]);
  useStore.setState({ enabled, autodisabled, lastError, registry: registryRes });

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id != null) {
    const applied = await getAppliedInTab(activeTab.id);
    useStore.setState({ activeTabId: activeTab.id, appliedInActiveTab: applied });
  }
}

// Subscribe to storage changes — popup is alive while open; listener auto-removed on close.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.enabled) useStore.setState({ enabled: (changes.enabled.newValue ?? {}) });
    if (changes.autodisabled) useStore.setState({ autodisabled: (changes.autodisabled.newValue ?? {}) });
    if (changes.last_error) useStore.setState({ lastError: (changes.last_error.newValue ?? {}) });
  } else if (areaName === 'session') {
    const tabId = useStore.getState().activeTabId;
    if (tabId != null) {
      const key = `applied:${tabId}`;
      if (changes[key]) useStore.setState({ appliedInActiveTab: (changes[key].newValue ?? []) });
    }
  }
});

void bootstrapStore();

const container = document.getElementById('root');
if (!container) throw new Error('popup: #root missing');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

### Status computation (D-08, D-10) — pure function for tests

```ts
// apps/extension/src/popup/status.ts
import type {
  AutoDisableRecord,
  ExperimentStatus,
  RegistryEntry,
} from '@platform/experiment-sdk';
import { matchesUrl } from '@/shared/url-match';

export function computeStatus(
  entry: RegistryEntry,
  ctx: {
    enabled: boolean;
    autodisabled?: AutoDisableRecord;
    appliedInActiveTab: string[];
    activeTabUrl?: string;          // undefined if popup couldn't read it
  },
): ExperimentStatus {
  if (ctx.autodisabled) return 'auto-disabled';
  if (!ctx.enabled) return 'disabled';
  // enabled === true beyond this point.
  const scopeMatches = ctx.activeTabUrl != null && matchesUrl(ctx.activeTabUrl, entry.scope.match);
  if (!scopeMatches) return 'pending';
  if (ctx.appliedInActiveTab.includes(entry.id)) return 'applied';
  // enabled + scope matches + NOT in applied set → an apply attempt failed (or hasn't run yet).
  // Reading last_error in computeStatus would create coupling; instead the popup row reads
  // last_error[entry.id] separately to decide between 'error' and a transient pending state.
  // Recommendation: return 'error' if last_error[entry.id] is recent (<10s), else 'pending'.
  return 'error';
}
```

The popup row component combines `computeStatus` + `lastError[id]` to render the final badge + error row.

### `useStore` selector hygiene

Use granular selectors to avoid re-renders:

```ts
// In a row component
const enabled = useStore((s) => s.enabled[entry.id] ?? false);
const autodisabled = useStore((s) => s.autodisabled[entry.id]);
const lastError = useStore((s) => s.lastError[entry.id]);
const isApplied = useStore((s) => s.appliedInActiveTab.includes(entry.id));
```

For Phase 2's tiny popup (~6 components, 1 author, 1 experiment in the smoke case), `useShallow` is overkill. Add it later if a popup with 50+ rows shows perf issues.

---

## 9. Vitest Mock Extensions

### Current state (Phase 1)

`apps/extension/src/test-setup/chrome-mock.ts` already provides:
- `chrome.storage.{local,session}` with `_data: Record<string, unknown>` + `get`, `set`, `remove`, `clear`.
- `chrome.runtime.onMessage.{addListener, removeListener, hasListener}`, `chrome.runtime.sendMessage`, `chrome.runtime.lastError`.
- `chrome.tabs.{query, sendMessage}`.
- `vi.stubGlobal('chrome', makeChromeMock())` per `beforeEach`.

### Phase 2 additions

```ts
// apps/extension/src/test-setup/chrome-mock.ts (additive)

// 1) chrome.storage.onChanged — listener registry that fires when set/remove are called.
type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: 'local' | 'session' | 'managed' | 'sync',
) => void;

// 2) chrome.storage.session.setAccessLevel mock (no-op; just record calls).

// 3) chrome.runtime.getURL(path) → returns `chrome-extension://<fake-id>/${path}`.
// 4) Mock fetch for registry.json: tests call vi.stubGlobal('fetch', vi.fn(...)) per-test.

export function makeChromeMock(): ChromeMock {
  const changeListeners: ChangeListener[] = [];

  function fireChange(
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: 'local' | 'session',
  ): void {
    for (const l of changeListeners) l(changes, areaName);
  }

  function makeStorageArea(area: 'local' | 'session'): StorageAreaMock {
    const data: StorageRecord = {};
    return {
      _data: data,
      get: vi.fn(/* unchanged from Phase 1 */),
      set: vi.fn(async (items: StorageRecord) => {
        const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: data[k], newValue: v };
          data[k] = v;
        }
        fireChange(changes, area);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
        for (const k of arr) {
          if (k in data) {
            changes[k] = { oldValue: data[k], newValue: undefined };
            delete data[k];
          }
        }
        if (Object.keys(changes).length > 0) fireChange(changes, area);
      }),
      clear: vi.fn(/* fires changes for all keys */),
    };
  }

  return {
    storage: {
      local: makeStorageArea('local'),
      session: Object.assign(makeStorageArea('session'), {
        setAccessLevel: vi.fn(async () => {}),
      }),
      onChanged: {
        addListener: vi.fn((l: ChangeListener) => changeListeners.push(l)),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
    },
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      sendMessage: vi.fn(),
      getURL: vi.fn((p: string) => `chrome-extension://test/${p.replace(/^\//, '')}`),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      sendMessage: vi.fn(),
    },
  };
}
```

### Per-test mocking pattern for `@webext-core/messaging`

`@webext-core/messaging` calls `chrome.runtime.{onMessage.addListener, sendMessage, tabs.sendMessage}` internally. For unit-testing handlers, **bypass the library and call the handler directly:**

```ts
// apps/extension/src/background/handlers/experiment-toggle.test.ts
import { describe, expect, it, vi } from 'vitest';
import { handleExperimentToggle } from './experiment-toggle';

describe('handleExperimentToggle', () => {
  it('writes enabled flag and broadcasts STATE_CHANGED', async () => {
    chrome.tabs.query = vi.fn(async () => [
      { id: 1 } as chrome.tabs.Tab,
      { id: 2 } as chrome.tabs.Tab,
    ]);
    chrome.tabs.sendMessage = vi.fn(async () => undefined);
    const result = await handleExperimentToggle({ id: '01HXX...', enabled: true });
    expect(result).toEqual({ ok: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('clears autodisabled + error_window on toggle ON', async () => {
    chrome.storage.local._data['autodisabled'] = { 'X': { /* ... */ } };
    chrome.storage.session._data['error_window:X'] = { count: 2, firstAt: Date.now() };
    await handleExperimentToggle({ id: 'X', enabled: true });
    expect(chrome.storage.local._data['autodisabled']).toEqual({});
    expect('error_window:X' in chrome.storage.session._data).toBe(false);
  });
});
```

For integration-testing the bus end-to-end, mock `@webext-core/messaging` with `vi.mock('@webext-core/messaging', ...)` returning a stub `defineExtensionMessaging` whose `onMessage` records handlers and whose `sendMessage` invokes them synchronously.

---

## 10. Auto-Disable Error-Window Data Structure (sliding window math)

### State shape (D-09 + D-12)

```ts
// chrome.storage.session
type ErrorWindow = { count: number; firstAt: number };  // key: error_window:<ulid>

// chrome.storage.local
type AutoDisableRecord = {
  reason: string;
  count: number;
  firstAt: number;
  lastAt: number;
};  // map under key: autodisabled
```

### Sliding-window math (D-11: ≥3 errors in 10s)

The naïve "fixed window" approach (count up; reset on a time-elapsed check) is wrong: 2 errors at t=0, 1 error at t=11s would NOT trip even though 3 errors total — but 2 errors at t=0 + 1 error at t=9s + 1 error at t=18s SHOULD trip the second time too if there are 2 within the last 10s.

**Recommended approach (counter-with-reset, sufficient for the threshold):**

The simplest *correct* algorithm for "≥N errors in window W":
1. On each error: check if `now - firstAt > W`. If yes, reset: `firstAt = now`, `count = 1`. If no, `count++`.
2. After increment, if `count >= N`: trip auto-disable; reset window.

```ts
// apps/extension/src/background/handlers/experiment-error.ts
import type { ErrorReport } from '@/shared/messages';
import {
  clearErrorWindow,
  getErrorWindow,
  setErrorWindow,
  setAutoDisable,
  setLastError,
} from '@/shared/storage';

const WINDOW_MS = 10_000;
const THRESHOLD = 3;

export async function handleExperimentError({
  id,
  phase,
  message,
  stack,
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
    await clearErrorWindow(id);  // reset so re-arm starts clean
    // Broadcast STATE_CHANGED so popup updates and content scripts stop the experiment.
    // (Same broadcast helper used by handleExperimentToggle.)
  }
  return { ok: true };
}
```

**Why this is sufficient:** the user-facing semantic is "if 3 errors happen close together, kill it." The "fixed window with rolling reset on first stale event" satisfies this for the documented ≥3-in-10s threshold without needing a circular buffer of timestamps. Edge cases (10 errors at t=0..9s = trip, then 1 error at t=11s = new window of 1) are correct.

**AbortError exclusion (D-02 / D-11):** content scripts must filter `AbortError` BEFORE sending `EXPERIMENT_ERROR`:

```ts
// In content-isolated.content.ts reconcile cleanup branch:
try {
  await cleanup();
} catch (err) {
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

---

## 11. Per-Tab Applied Set (`chrome.storage.session` keying)

### Write site — content script after every reconcile (D-09)

```ts
// In apps/extension/entrypoints/content-isolated.content.ts reconcile()
import { setAppliedInTab } from '@/shared/storage';

async function reconcile(...) {
  // ... existing apply/cleanup logic ...

  // After reconcile completes, write the current applied set for THIS tab.
  // We need the tabId; content scripts can't query their own tab id directly,
  // but the SW can send it via STATE_CHANGED if needed. Simpler: the content
  // script asks the SW once on bootstrap.
  const myTabId = await getMyTabId();  // see below
  await setAppliedInTab(myTabId, Array.from(cleanups.keys()));
}
```

### How content scripts learn their own tab id

Content scripts have no direct API for "my tab id". Three options:

1. **Ask SW once on bootstrap.** Content script sends a `WHO_AM_I` message → SW reads `sender.tab.id` from the message envelope → returns it. Phase 2 has no `WHO_AM_I` in the protocol; we can either add it (low cost) OR extend `STATE_CHANGED` payload to include the tab id. **Recommendation: add `WHO_AM_I` to the ProtocolMap.**

2. **Use a synthetic id derived from `location.href + Date.now()`.** Bad — multiple tabs on same URL collide; popup needs the *real* tab id to read the right key.

3. **Have the SW prepend tab id to STATE_CHANGED payload.** Requires changing `STATE_CHANGED()` from `void` to `{tabId: number}`, but then SW would need to send a different payload to each tab — already does, just makes the per-tab payload explicit.

**Recommendation: Option 3.** Change D-05's `STATE_CHANGED(): void` to `STATE_CHANGED(data: {tabId: number}): void`. The SW already iterates `chrome.tabs.query({})` to broadcast; including the tab id in each per-tab message is a one-line addition. Content script caches the tabId on first `STATE_CHANGED` and uses it for `setAppliedInTab(tabId, ...)`. **Note for planner:** this is a refinement of D-05 within Claude's Discretion (the broadcast mechanism is the same; only the payload is enriched). If the planner prefers Option 1 (`WHO_AM_I`), document the decision in the plan.

### Read site — popup on mount (D-26)

```ts
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (activeTab?.id != null) {
  const applied = await getAppliedInTab(activeTab.id);
  useStore.setState({ activeTabId: activeTab.id, appliedInActiveTab: applied });
}
```

### Cleanup of stale `applied:<tabId>` keys

Tabs close. `applied:<tabId>` keys for closed tabs accumulate in `chrome.storage.session`. **Mitigation:** session storage is wiped on browser restart (which is the natural cleanup). Within a session, the SW can register `chrome.tabs.onRemoved` to delete the corresponding key:

```ts
// background.ts (top-level — listener)
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(`applied:${tabId}`);
});
```

`chrome.tabs.onRemoved` is a top-level listener (SP-7-compatible). Add to `background.ts` alongside the `onMessage` calls.

---

## 12. Validation Architecture (UNIT/INTEGRATION/BROWSER-MANUAL)

> Required because `workflow.nyquist_validation = true` in `.planning/config.json` (verified line 22). All Phase 2 requirements get a test plan.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (already pinned) |
| Config file | `apps/extension/vitest.config.ts` (Phase 1) + root `vitest.config.ts` aggregator |
| Quick run | `pnpm test --run` (workspace-aware, runs all packages) |
| Full suite | `pnpm test --run && pnpm typecheck && pnpm lint && pnpm check-csp && pnpm build` |
| Manual smoke | `pnpm build` → load unpacked → ya.ru → toggle → 5-state observation |

### Phase 2 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ENG-04 | TS contract `apply({tweaks, helpers, currentURL, log, signal}) → cleanup` | TS-only (compile-error) | `pnpm typecheck` (deliberate violation in `apps/extension/src/content/contract.test.ts` produces `// @ts-expect-error` annotated lines that fail when removed) | ❌ Wave 0 |
| ENG-04 | AbortSignal honored on cleanup, AbortError NOT counted | unit | `pnpm vitest run apps/extension/src/content/abort-signal.test.ts` | ❌ Wave 0 |
| ENG-06 | Sliding-window counter increments / resets / trips | unit | `pnpm vitest run apps/extension/src/background/handlers/experiment-error.test.ts` | ❌ Wave 0 |
| ENG-06 | Toggle OFF→ON clears autodisabled + error_window | unit | `pnpm vitest run apps/extension/src/background/handlers/experiment-toggle.test.ts -t recovery` | ❌ Wave 0 |
| ENG-06 | Reconcile filters out auto-disabled IDs | unit | `pnpm vitest run apps/extension/src/content/engine.test.ts -t auto-disabled` | ❌ Wave 0 |
| MAN-03 | ULID-keyed storage survives folder rename | unit (rename simulation: write key, "rename" by changing manifest file path, re-read key by ULID) | `pnpm vitest run apps/extension/src/shared/storage.test.ts -t rename` | ❌ Wave 0 |
| MAN-04 | SDK exports `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId` | unit | `pnpm vitest run packages/experiment-sdk/src/index.test.ts` | ❌ Wave 0 |
| BLD-03 | `dist/registry.json` emitted with all 8 schema fields | build-output assertion | `pnpm build && node -e "JSON.parse(fs.readFileSync('apps/extension/.output/chrome-mv3/registry.json'))"` + `pnpm vitest run tools/build-experiments.test.ts -t registry` | ❌ Wave 0 |
| BLD-04 | One chunk per experiment in built output | build-output assertion | `pnpm vitest run tools/build-experiments.test.ts -t chunks` (uses fixture experiments, runs Vite programmatically, asserts `bundle` has one entry per experiment) | ❌ Wave 0 |
| UI-01 | Popup uses shadcn Switch/Card/Collapsible/Badge/ScrollArea/Button, Tailwind v4, React 19 | unit (jsdom render via `@testing-library/react`) + visual smoke (manual) | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx` (renders App, asserts `data-slot="switch"` etc.) | ❌ Wave 0 (also need `@testing-library/react`) |
| UI-03 | Author grouping alphabetical case-insensitive, count = total experiments by author | unit | `pnpm vitest run apps/extension/src/popup/grouping.test.ts` | ❌ Wave 0 |
| UI-04 | Toggle dispatches EXPERIMENT_TOGGLE; status badge reflects 5 states | unit (RTL) + manual | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx -t status` | ❌ Wave 0 |
| UI-08 | Error message + click-expand stack trace render | unit (RTL) | `pnpm vitest run apps/extension/entrypoints/popup/App.test.tsx -t error-stack` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --run --changed`
- **Per wave merge:** `pnpm test --run && pnpm typecheck && pnpm check-csp`
- **Phase gate:** Full suite green + browser-manual MV3 smoke checklist passed

### Browser-Manual MV3 Smoke (the literal end-to-end gate)

Run on Chrome 133+ stable with `apps/extension/.output/chrome-mv3/` loaded via "Load unpacked".

1. **5-state badge render:** force each state by manipulating storage in popup devtools or by editing the smoke experiment to throw on apply; confirm all five badge variants render with the documented label.
2. **Toggle persists across SW restart:** toggle smoke ON → page pink → `chrome://serviceworker-internals` → Stop → wait 2 seconds → re-open popup → toggle still shows ON → page is still pink (or re-pinks on the active tab if the content script restarts on Stop).
3. **3-errors-in-10s trip:** modify smoke to throw on apply → toggle ON → tab tries to apply, fails 3× in <10s → popup shows `Auto-disabled` red-outline badge with `Disabled after 3 errors in 10s — click toggle to re-enable` → toggle OFF → toggle ON → counter resets, smoke applies again (or fails again, this time recording fresh window).
4. **`registry.json` artifact:** `cat apps/extension/.output/chrome-mv3/registry.json` shows valid JSON array with all 8 fields per experiment.
5. **Toggle OFF on ya.ru tab:** on `https://ya.ru/` with smoke pinking, toggle OFF in popup → page reverts to white within ~1 second → popup status badge changes from green "Applied" to gray "Off".

### Wave 0 Gaps

All test infrastructure files that must exist before implementation tasks merge:

- [ ] `apps/extension/src/content/contract.test.ts` — TS-only `@ts-expect-error` violations for ENG-04 contract
- [ ] `apps/extension/src/content/abort-signal.test.ts` — AbortSignal honored, AbortError not counted
- [ ] `apps/extension/src/background/handlers/experiment-error.test.ts` — sliding window math
- [ ] `apps/extension/src/background/handlers/experiment-toggle.test.ts` — recovery + broadcast
- [ ] `apps/extension/src/content/engine.test.ts` — extend Phase 1's tests with auto-disabled filter
- [ ] `apps/extension/src/shared/storage.test.ts` — extend with auto-disabled, error-window, applied-in-tab, migration idempotency
- [ ] `apps/extension/src/popup/store.test.ts` — Zustand slice composition + onChanged subscription
- [ ] `apps/extension/src/popup/status.test.ts` — `computeStatus` pure function 5-state coverage
- [ ] `apps/extension/src/popup/grouping.test.ts` — author grouping alphabetical/case-insensitive
- [ ] `apps/extension/entrypoints/popup/App.test.tsx` — RTL render of full popup with mocked store + assert badges + toggle dispatch
- [ ] `tools/build-experiments.test.ts` — extend Phase 1's 13 tests with `registry.json` shape + chunk-path mapping + `manualChunks` placement
- [ ] `packages/experiment-sdk/src/index.test.ts` — extend Phase 1's manifest tests with `byId` helper + new type exports compile-test
- [ ] `apps/extension/src/test-setup/chrome-mock.ts` — extended per §9 (storage.onChanged, setAccessLevel, getURL)
- [ ] Framework adds: `pnpm add -D @testing-library/react @testing-library/jest-dom jsdom` (in `apps/extension/`)
- [ ] `apps/extension/vitest.config.ts` — add `environment: 'jsdom'` for popup tests (or per-test override)

---

## 13. Risks + Assumptions Table

| # | Risk / Assumption | Confidence | Mitigation | Status |
|---|---|---|---|---|
| **R1** | `@webext-core/messaging`'s `onMessage()` registers the underlying `chrome.runtime.onMessage.addListener` synchronously at module top-level, preserving SP-7 (Pitfall 1). | HIGH [CITED: webext-core.aklinker1.io/messaging/installation] — library is by WXT author, explicitly designed for MV3 SW. | Wave 1 includes a verification task: read `node_modules/@webext-core/messaging/dist/index.js`, grep for `chrome.runtime.onMessage.addListener`, confirm the call site is reached on import. If somehow lazy, fall back to a thin wrapper that calls `chrome.runtime.onMessage.addListener` at module top and routes by type. | RESOLVED at doc level; verify in code |
| **R2** | WXT 0.20.25's `defineBackground` permits splitting handlers into separate files while preserving SP-7. | HIGH — Phase 1 already verified the top-level pattern survives WXT's IIFE wrapping (built `background.js` IIFE registers listener BEFORE `o.main()`). Splitting handlers into `apps/extension/src/background/handlers/*.ts` doesn't move the registration; the registration is still in `background.ts` at module top. | Phase 2 keeps `onMessage(...)` calls at module top in `background.ts`; handler functions are imported but not invoked there. | RESOLVED — same pattern as Phase 1, just refactored bodies |
| **R3** | shadcn/ui's CLI works cleanly inside `apps/extension/` (a WXT subpackage in pnpm monorepo); `components.json` aliases `@/components` and `@/components/ui` resolve to `apps/extension/src/components/...` at runtime AND TS time. | MEDIUM-HIGH — `@/` alias is wired in BOTH `wxt.config.ts:31` (Vite) and root `tsconfig.json` (project refs). Verify `apps/extension/tsconfig.json` has `paths: {"@/*": ["./src/*"]}` after `shadcn init`. | Wave 3 sub-task: run `pnpm dlx shadcn@latest init` from `apps/extension/`, inspect `apps/extension/tsconfig.json` post-state, manually add `paths` if shadcn didn't. Verify imports resolve via `pnpm typecheck`. | OPEN — Wave 3 verifies |
| **R4** | WXT may inject its own `web_accessible_resources` for HMR; emitting `registry.json` must not collide. | HIGH — Chrome docs say no WAR needed for popup or content-script `getURL` reads from extension origin. WXT's HMR-WAR is about page-origin script injection, unrelated. | No manifest fragment for `registry.json`. Verified via `cat apps/extension/.output/chrome-mv3/manifest.json` shows no `web_accessible_resources` field today; Phase 2 changes don't introduce one. | RESOLVED [CITED: developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources] |
| **R5** | Vite's per-chunk file names depend on dynamic-import call sites; `chunkPath` written to `registry.json` must match the actual emitted file name. | HIGH — `manualChunks` function-form pins each experiment to a stable chunk name; `chunkFileNames: 'chunks/[name]-[hash].js'` produces stable filenames; `generateBundle.bundle[fileName].facadeModuleId` is the canonical mapping. | Wave 2 includes a test that runs Vite programmatically against fixture experiments, inspects `bundle` in a captured plugin hook, and asserts `registry.json[i].chunkPath` matches an actual entry in `bundle`. | RESOLVED [CITED: rollupjs.org/configuration-options/#output-chunkfilenames; /plugin-development] |
| **R6** | `chrome.storage.session` is per-browser-session and not exposed to content scripts by default — content scripts MUST be granted access via `setAccessLevel({accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'})`. | HIGH [CITED: developer.chrome.com/docs/extensions/reference/api/storage] — explicitly documented. | SW calls `setAccessLevel` inside `defineBackground` main on every wake (idempotent). Wave 1 sub-task: include this call AND a unit test asserting the setAccessLevel mock is called. Failure mode: content scripts throw `Access to storage.session denied` at first write; surface this in error logs. | OPEN — must implement |
| **R7** | Storage migration in D-29 (per-key `last_error:<id>` → single `last_error` map) needs to be idempotent and run-once-safe across multiple SW wake-ups, AND must run BEFORE any handler reads/writes `last_error`. | HIGH — implemented via `_migrations` array in `chrome.storage.local`; migration name added on success; future wake reads-and-exits early. | Migration runs at top of `background.ts` BEFORE `onMessage` registrations (planner: confirm ordering — see §3). Unit test: 1st call migrates 5 old keys → reads new map = correct shape; 2nd call no-ops; 3rd call after a deliberate Phase-2 write to `last_error` does NOT clobber. | OPEN — Wave 0 implements + tests |
| **R8** | NEW: tab id discovery in content scripts. The content script must know its own tabId to write `applied:<tabId>` to `chrome.storage.session`, but content scripts have no direct API. | HIGH — solvable two ways (refined STATE_CHANGED payload OR new `WHO_AM_I` message). | Recommendation: enrich `STATE_CHANGED` payload to `{tabId: number}` (Option 3 in §11). The SW already iterates tabs to send the broadcast; including the tabId is a one-liner. Cache the tabId in content-script module scope on first STATE_CHANGED. **Note:** content-script module scope is per-document, NOT shared across tabs — caching is safe. | OPEN — minor refinement of D-05 within Claude's Discretion |
| **R9** | NEW: shadcn install adds new dependencies (`class-variance-authority`, `lucide-react`, `tw-animate-css`, several `@radix-ui/react-*`) that need version pinning. | HIGH — versions are determined by shadcn CLI at install time. | Wave 3 records the shadcn-installed versions in `apps/extension/package.json`; subsequent waves don't bump. Add a CI assertion that `pnpm install --frozen-lockfile` succeeds. | OPEN — Wave 3 captures |
| **R10** | NEW: Popup row component re-renders when ANY storage key changes if not using granular Zustand selectors. With 5 status states × 6 components × 1 author × 1 experiment in the smoke case, perf is fine — but the planner should still use granular selectors for forward-compat. | MEDIUM | Use `useStore((s) => s.enabled[id] ?? false)` style selectors; avoid `useStore((s) => s)`. Lint rule (eslint-plugin-zustand-rules or manual review) optional in Phase 2. | OPEN — code review gate |
| **A1** | Tailwind v4 + shadcn/ui CLI 4.x is current and supports React 19. | HIGH — RESEARCH confirms shadcn migrated to Tailwind v4 mid-2025; Phase 1 pinned `tailwindcss ^4.2.4`. | Verify in Wave 3: `pnpm dlx shadcn@latest --version` should print `^4.x.x`. | RESOLVED at doc level |
| **A2** | The SDK additions (`RegistryEntry`, etc.) are zero-runtime; only `byId` is a function. | HIGH — `byId(registry, id) = registry.find(e => e.id === id)`. | Phase 2 SDK package keeps `peerDependencies: { zod: ^4.0.0 }` and `dependencies: { zod: ^4.3.6 }` (from Phase 1) — no new deps. | RESOLVED |
| **A3** | The literal browser smoke (5 status states; toggle persists across SW restart; 3-errors-in-10s trip; registry.json emit; revert on toggle OFF) cannot be replaced by automated tests. | HIGH — same as Phase 1's `human_verification` rule. | Phase gate includes manual smoke checklist (§12 above). Andrew runs in his local Chrome; record outcome in 02-VERIFICATION.md. | DEFERRED to phase verification |
| **A4** | The architectural responsibility map (§2) reflects D-decisions; SW remains stateless, content scripts own per-tab cleanups, popup is the sole derived-state computer. | HIGH — directly traceable to D-06, D-09, D-10. | No mitigation needed. | RESOLVED |

---

## 14. Files to Create / Modify

> All paths are absolute from repo root. **Modify** = file exists, will be edited. **Create** = new file.

### `@platform/experiment-sdk` (D-30, D-31)

- **Modify:** `packages/experiment-sdk/src/index.ts` — add `RegistryEntry`, `Registry`, `ExperimentStatus`, `ErrorRecord`, `AutoDisableRecord`, `byId(registry, id)` exports. Phase 1 types stay.
- **Create:** `packages/experiment-sdk/src/registry.test.ts` — covers `byId` (found / not-found / empty registry).
- **Modify (test):** `packages/experiment-sdk/src/manifest.test.ts` — add a compile-test that imports each new type to assert exports exist.

### Storage (D-09, D-12, D-28, D-29)

- **Modify:** `apps/extension/src/shared/storage.ts` — add helpers per §7 (auto-disabled, error-window, applied-in-tab, last-error map, `runStartupMigration`). Keep Phase 1 helpers.
- **Modify (test):** `apps/extension/src/shared/storage.test.ts` — extend with new helper coverage + migration idempotency.
- **Create (fixture):** none — tests use the in-memory chrome-mock.

### Messaging Bus (D-04, D-05)

- **Modify:** `apps/extension/src/shared/messages.ts` — REPLACE Phase 1 tag union with `defineExtensionMessaging<ProtocolMap>()` + ProtocolMap interface (4 messages). Remove `isExtensionMessage` (no callers after refactor).
- **Modify:** `apps/extension/package.json` — add `"@webext-core/messaging": "^1.x"` to dependencies (verify exact version with `npm view @webext-core/messaging version` at install time).
- **Create:** `apps/extension/src/shared/messages.test.ts` — type-only test asserting ProtocolMap is well-formed (compile-only).

### SW Orchestrator (D-06, D-07, D-15)

- **Modify:** `apps/extension/entrypoints/background.ts` — replace tag-union onMessage with `onMessage('EXPERIMENT_TOGGLE', ...)` + `onMessage('EXPERIMENT_ERROR', ...)`; call `runStartupMigration()` first; call `chrome.storage.session.setAccessLevel(...)` in defineBackground main; register `chrome.tabs.onRemoved` cleanup of `applied:<tabId>`.
- **Create:** `apps/extension/src/background/handlers/experiment-toggle.ts` — `handleExperimentToggle({id, enabled})` per §3.
- **Create:** `apps/extension/src/background/handlers/experiment-error.ts` — `handleExperimentError({id, phase, message, stack})` per §10 (sliding-window math).
- **Create:** `apps/extension/src/background/broadcast.ts` — `broadcastStateChanged()` shared helper (used by both handlers).
- **Create:** `apps/extension/src/background/handlers/experiment-toggle.test.ts` — recovery + broadcast assertions.
- **Create:** `apps/extension/src/background/handlers/experiment-error.test.ts` — sliding-window correctness.

### Engine + Content Scripts (D-01, D-02, D-15)

- **Modify:** `apps/extension/src/content/engine.ts` — add per-call AbortController creation + abort-before-cleanup; add `filterAutoDisabled(manifests, autodisabledMap)` function used by reconcile.
- **Modify:** `apps/extension/entrypoints/content-isolated.content.ts` — wrap reconcile to (a) read `autodisabled` from storage and filter; (b) catch apply/cleanup errors → call `sendMessage('EXPERIMENT_ERROR', {...})`; (c) write `applied:<tabId>` to `chrome.storage.session` after each reconcile completion; (d) cache tabId from first STATE_CHANGED payload.
- **Modify:** `apps/extension/entrypoints/content-main.content.ts` — same (still empty in Phase 2 because no MAIN-world experiments, but the wiring lands so a Phase 3+ MAIN experiment activates without re-architecture).
- **Create:** `apps/extension/src/content/contract.test.ts` — TS-only `@ts-expect-error` assertions for ENG-04 (compile fails if removed).
- **Create:** `apps/extension/src/content/abort-signal.test.ts` — verifies AbortController.abort() is called before cleanup; AbortError NOT escalated to EXPERIMENT_ERROR.
- **Modify:** `apps/extension/src/content/error-isolation.test.ts` — extend Phase 1's tests with auto-disabled filter assertion.

### Build Plugin (D-16, D-17, D-18)

- **Modify:** `tools/build-experiments.ts` — add `generateBundle` hook per §5 emitting `registry.json` with chunk-path lookup; cache `scan` between buildStart and generateBundle.
- **Modify:** `apps/extension/wxt.config.ts` — add `build.rollupOptions.output.{chunkFileNames, manualChunks}` per §5.
- **Modify:** `tools/build-experiments.test.ts` — extend with `registry.json` shape test + chunk-path mapping test (use Vite programmatic API to run a fixture build).

### Popup Shell (D-19, D-20, D-21, D-22, D-23, D-24, D-25, D-26, D-27)

- **Modify:** `apps/extension/package.json` — add `zustand ^5.0.12`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `@radix-ui/react-switch`, `@radix-ui/react-collapsible`, `@radix-ui/react-scroll-area` (whichever shadcn `add` installs); add devDeps `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- **Create:** `apps/extension/components.json` — produced by `pnpm dlx shadcn@latest init`.
- **Create:** `apps/extension/src/lib/utils.ts` — produced by `shadcn init` (`cn(...inputs: ClassValue[])`).
- **Create:** `apps/extension/src/components/ui/switch.tsx` — produced by `shadcn add switch`.
- **Create:** `apps/extension/src/components/ui/card.tsx` — produced by `shadcn add card`.
- **Create:** `apps/extension/src/components/ui/collapsible.tsx` — produced by `shadcn add collapsible`.
- **Create:** `apps/extension/src/components/ui/badge.tsx` — produced by `shadcn add badge`.
- **Create:** `apps/extension/src/components/ui/scroll-area.tsx` — produced by `shadcn add scroll-area`.
- **Create:** `apps/extension/src/components/ui/button.tsx` — produced by `shadcn add button`.
- **Modify:** `apps/extension/src/styles/popup.css` — `shadcn init` augments with `@theme inline { ... }` variables and `@plugin "tw-animate-css";`.
- **Create:** `apps/extension/src/popup/store.ts` — Zustand store per §8.
- **Create:** `apps/extension/src/popup/status.ts` — `computeStatus` pure function per §8.
- **Create:** `apps/extension/src/popup/grouping.ts` — `groupByAuthor(registry, enabled)` returns alphabetical array of `{author, entries, expanded}`.
- **Modify:** `apps/extension/entrypoints/popup/main.tsx` — replace Phase 1 mount with bootstrap-then-render per §8 (bootstrap fetches registry.json + initial storage; registers onChanged listener; mounts React).
- **Modify:** `apps/extension/entrypoints/popup/App.tsx` — REPLACE Phase 1 inline-style list with shadcn shell per D-21 ASCII layout.
- **Create:** `apps/extension/entrypoints/popup/components/AuthorGroup.tsx` — Collapsible per author with header `{author} ({count})`.
- **Create:** `apps/extension/entrypoints/popup/components/ExperimentRow.tsx` — Card with name, description, Badge (status), Switch (toggle), inline error block + Collapsible stack.
- **Create:** `apps/extension/entrypoints/popup/App.test.tsx` — RTL render of full popup with mocked store + assert each badge variant + toggle dispatches the right message.
- **Create:** `apps/extension/src/popup/store.test.ts` — slice composition + onChanged subscription.
- **Create:** `apps/extension/src/popup/status.test.ts` — `computeStatus` 5-state coverage.
- **Create:** `apps/extension/src/popup/grouping.test.ts` — alphabetical case-insensitive + count.

### Manifest

- **Modify:** `apps/extension/wxt.config.ts` — no `web_accessible_resources` for `registry.json` (per §6); add the new `vite.build.rollupOptions` from §5; keep existing `host_permissions`, `permissions`, `manifest` block.

### Test Setup

- **Modify:** `apps/extension/src/test-setup/chrome-mock.ts` — extend per §9 (storage.onChanged, storage.session.setAccessLevel, runtime.getURL, fireChange wiring).
- **Modify:** `apps/extension/vitest.config.ts` — set `environment: 'jsdom'` (or per-file pragma) for popup tests.

### Documentation

- **Create:** `.planning/phases/02-state-foundation-messaging-popup-shell/02-PATTERNS.md` (output of `gsd-pattern-mapper` next; not Phase 2 planner work).

---

## 15. Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — `@webext-core/messaging` named explicitly; zustand 5; shadcn install commands
- `.planning/research/ARCHITECTURE.md` — Level 1 + Level 2 mapping
- `.planning/research/PITFALLS.md` — Pitfall 1 (SW lifecycle), Pitfall 2 (CSP)
- `.planning/phases/01-foundation-spike-engine-skeleton/01-CONTEXT.md` — Phase 1 D-01..D-29
- `.planning/phases/01-foundation-spike-engine-skeleton/01-VERIFICATION.md` — Phase 1 closure
- `.planning/phases/01-foundation-spike-engine-skeleton/01-PATTERNS.md` — Phase 1 file conventions
- `docs/spike/MV3-FOUNDATION.md` — verified MV3 behaviors (SP-7, two-world routing, idle termination)
- In-tree code: `apps/extension/entrypoints/{background,content-isolated.content,content-main.content,popup/App,popup/main}.{ts,tsx}`, `apps/extension/src/shared/{storage,messages,url-match}.ts`, `apps/extension/src/content/engine.ts`, `apps/extension/src/test-setup/chrome-mock.ts`, `tools/build-experiments.ts`, `apps/extension/wxt.config.ts`, `packages/experiment-sdk/src/index.ts`

### Live-verified (HIGH confidence)
- [`@webext-core/messaging` installation](https://webext-core.aklinker1.io/messaging/installation) — `defineExtensionMessaging`, `onMessage`, `sendMessage` API; module-top synchronous registration
- [`@webext-core/messaging` protocol-maps](https://webext-core.aklinker1.io/messaging/protocol-maps) — verbatim ProtocolMap shape
- [Chrome MV3 storage docs](https://developer.chrome.com/docs/extensions/reference/api/storage) — storage.session 10MB quota, persistence semantics, `setAccessLevel` requirement for content scripts, `onChanged` `areaName` arg
- [Chrome MV3 web-accessible-resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources) — content scripts and popup do NOT require declarations to fetch extension resources
- [Rollup output.chunkFileNames](https://rollupjs.org/configuration-options/#output-chunkfilenames) — placeholders, function form `(PreRenderedChunk) => string`, `facadeModuleId`
- [Rollup output.manualChunks](https://rollupjs.org/configuration-options/#output-manualchunks) — object + function forms
- [Rollup plugin `generateBundle`](https://rollupjs.org/plugin-development/) — `bundle` keyed by filename; `OutputChunk.facadeModuleId`; `this.emitFile({type:'asset', fileName, source})`
- [shadcn/ui Vite install](https://ui.shadcn.com/docs/installation/vite) — `pnpm dlx shadcn@latest init -t vite`, Tailwind v4 single-line `@import "tailwindcss";`, `@/*` paths in tsconfig
- [shadcn/ui manual install](https://ui.shadcn.com/docs/installation/manual) — `components.json` shape (aliases.components, aliases.ui, css path)
- [Zustand slice composition (deepwiki mirror)](https://deepwiki.com/pmndrs/zustand/7.1-slices-pattern) — `StateCreator<RootState, [], [], SliceType>`, `create<RootState>()((...a) => ({...sliceA(...a), ...sliceB(...a)}))`, store API outside React (subscribe / setState)
- [WXT InlineConfig](https://wxt.dev/api/reference/wxt/interfaces/InlineConfig.html) — `vite: (env) => ({build: {rollupOptions: {output: {...}}}})` shape

### Tertiary / inferred
- Vitest 4.x extension of Phase 1's chrome-mock pattern (in-tree)
- `@testing-library/react` for popup unit tests — standard React 19 usage; verify version with `npm view`

---

## 16. Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — versions inherit from Phase 1's live-verified pins; new additions (`@webext-core/messaging`, `zustand`, shadcn deps) verified at doc level; Wave 0 confirms with `npm view` at install time.
- Architecture: **HIGH** — directly traceable to 31 locked D-decisions + Phase 1 invariants (SP-1, SP-2, SP-7).
- Pitfalls / risks: **HIGH** — all 10 risks have either RESOLVED or OPEN+mitigation status.
- `@webext-core/messaging` SP-7 ordering: **HIGH** with code-level verification scheduled in Wave 1.
- shadcn-CLI in WXT subpackage: **MEDIUM-HIGH** — Wave 3 verifies tsconfig.json `paths` after `init`.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days; if execution slips past this, re-run `npm view` for `@webext-core/messaging`, `zustand`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`).

## RESEARCH COMPLETE
