# Architecture Research

**Domain:** Chromium MV3 Browser Extension Platform (Designer Experiment Engine)
**Researched:** 2026-04-25
**Confidence:** MEDIUM-HIGH (MV3 patterns and CRXJS based on training data; flagged areas need empirical validation in Phase 1 spike)

> **Note on tooling:** External research tools (WebSearch, Context7) were unavailable for this research pass. Findings draw on training-data knowledge of MV3 (stable since 2023), CRXJS (Vite plugin), and standard Chrome extension architecture patterns. **Recommendation:** Phase 1 should include a 2-3 day "MV3 + CRXJS spike" to empirically validate the hot-reload contract, message-passing latency, and content script lifecycle assumptions documented here before locking in the engine architecture.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER PROCESS                               │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    EXTENSION CONTEXT                            │  │
│  │                                                                  │  │
│  │   ┌─────────────────────┐    ┌──────────────────────────────┐  │  │
│  │   │   Popup / SidePanel │    │      Options Page            │  │  │
│  │   │   (shadcn/ui app)   │    │   (API keys, dev mode)       │  │  │
│  │   │                     │    │                              │  │  │
│  │   │  - Experiment list  │    │  - LLM provider + key        │  │  │
│  │   │  - Toggle on/off    │    │  - Hot-reload toggle         │  │  │
│  │   │  - Tweak controls   │    │  - Counter / budget          │  │  │
│  │   └──────────┬──────────┘    └──────────────┬───────────────┘  │  │
│  │              │                              │                   │  │
│  │              │  chrome.runtime.sendMessage  │                   │  │
│  │              ▼                              ▼                   │  │
│  │   ┌────────────────────────────────────────────────────────┐   │  │
│  │   │          SERVICE WORKER (background.ts)                │   │  │
│  │   │                                                          │   │  │
│  │   │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │  │
│  │   │   │ Settings/    │  │  LLM Proxy   │  │ fetchPage   │  │   │  │
│  │   │   │ Storage      │  │  (OpenAI/    │  │ (CORS-free  │  │   │  │
│  │   │   │ Adapter      │  │   Anthropic) │  │  HTML fetch)│  │   │  │
│  │   │   └──────────────┘  └──────────────┘  └─────────────┘  │   │  │
│  │   │                                                          │   │  │
│  │   │   ┌──────────────────────────────────────────────────┐  │   │  │
│  │   │   │  Tab Orchestrator: which experiments per URL?    │  │   │  │
│  │   │   │  (matches scope patterns, dispatches apply())    │  │   │  │
│  │   │   └──────────────────────────────────────────────────┘  │   │  │
│  │   └────────────────────────────────┬───────────────────────┘   │  │
│  │                                    │                            │  │
│  │   chrome.tabs.sendMessage / chrome.scripting.executeScript      │  │
│  │                                    ▼                            │  │
│  │   ┌──────────────────────────────────────────────────────────┐ │  │
│  │   │         CONTENT SCRIPT (isolated world, per tab)          │ │  │
│  │   │                                                             │ │  │
│  │   │   ┌──────────────────────────────────────────────────┐    │ │  │
│  │   │   │              ENGINE RUNTIME                        │    │ │  │
│  │   │   │   - Load enabled experiments for this URL        │    │ │  │
│  │   │   │   - Build helpers proxy (llm, fetchPage)         │    │ │  │
│  │   │   │   - Call experiment.apply({tweaks, helpers,...}) │    │ │  │
│  │   │   │   - Track cleanup handles per experiment         │    │ │  │
│  │   │   │   - Listen for tweak-changed / hot-reload msgs   │    │ │  │
│  │   │   └──────────────────────────────────────────────────┘    │ │  │
│  │   │              │                  │                          │ │  │
│  │   │              ▼                  ▼                          │ │  │
│  │   │   ┌─────────────────┐  ┌─────────────────┐                │ │  │
│  │   │   │  Experiment A   │  │  Experiment B   │                │ │  │
│  │   │   │  (designer1/    │  │  (designer2/    │                │ │  │
│  │   │   │   weather-card) │  │   header-tweak) │                │ │  │
│  │   │   └────────┬────────┘  └────────┬────────┘                │ │  │
│  │   └────────────┼────────────────────┼────────────────────────┘ │  │
│  │                │                    │                          │  │
│  └────────────────┼────────────────────┼──────────────────────────┘  │
│                   ▼                    ▼                              │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                  PAGE DOM (target site, e.g. ya.ru)           │   │
│   │              [shared DOM, isolated JS contexts]               │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                      EXTERNAL SERVICES                            │
   │   ┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
   │   │  OpenAI / Anthr. │  │  Target Origins │  │  GitHub (repo)  │ │
   │   │  (LLM API)       │  │  (fetchPage)    │  │  (manual sync)  │ │
   │   └──────────────────┘  └─────────────────┘  └─────────────────┘ │
   └──────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────┐
   │                  STORAGE (chrome.storage.local)                   │
   │   - Per-experiment enable/disable state                           │
   │   - Per-experiment tweak values                                   │
   │   - Experiment activation order (array of IDs)                    │
   │   - LLM API key, provider                                         │
   │   - LLM session counter                                           │
   └──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Service Worker (SW)** | Source of truth for state; orchestration; privileged network calls (LLM, fetchPage); routes messages between popup ↔ content script | `src/background/main.ts`, event-driven (`chrome.runtime.onMessage`, `chrome.tabs.onUpdated`) |
| **Content Script Engine** | Per-tab runtime: loads experiments for URL, calls `apply()`, tracks cleanup, mediates helper calls, listens for tweak changes | `src/content/engine.ts`, injected via `content_scripts` declarative + dynamic re-injection |
| **Experiment Module** | Pure-ish JS module with `apply({tweaks, helpers, currentURL})` returning a `cleanup()` handle. Lives in `experiments/<user>/<id>/experiment.js` | Bundled at build time into `dist/experiments/*.js`; manifests aggregated into a registry |
| **Manifest Registry** | Aggregated index of all experiment manifests + bundle paths, generated at build time | `dist/registry.json` (build artifact) |
| **Popup / Side Panel** | shadcn/ui app: lists experiments, toggles, renders tweak controls from manifest schema | `src/popup/` (React + shadcn/ui), opens via toolbar |
| **Options Page** | Settings: API key, LLM provider, hot-reload toggle, session counters | `src/options/` (React + shadcn/ui) |
| **Storage Adapter** | Typed wrapper over `chrome.storage.local` with subscription/change-notify | `src/shared/storage.ts` |
| **Messaging Bus** | Typed wrapper over `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage` with request/response and event semantics | `src/shared/messaging.ts` |
| **Build Discovery** | Scans `experiments/**/manifest.json`, validates schema, emits per-experiment Vite entry points and registry | `tools/build-experiments.ts` (Vite plugin / pre-build script) |

---

## Recommended Project Structure

```
designer-experiment-platform/
├── plugin/                              # The extension itself (one Vite project)
│   ├── manifest.json                    # MV3 manifest (or generated from manifest.config.ts)
│   ├── vite.config.ts                   # CRXJS-based config
│   ├── src/
│   │   ├── background/
│   │   │   ├── main.ts                  # SW entry: register listeners
│   │   │   ├── orchestrator.ts          # match URL → enabled experiments → dispatch
│   │   │   ├── llm-proxy.ts             # OpenAI/Anthropic adapter
│   │   │   ├── fetch-page.ts            # fetch + DOMParser helper
│   │   │   └── hot-reload.ts            # dev-only: watch + push
│   │   ├── content/
│   │   │   ├── engine.ts                # main entry: load + apply experiments
│   │   │   ├── experiment-loader.ts     # dynamic import of bundled experiments
│   │   │   ├── helpers.ts               # llm/fetchPage proxy → SW
│   │   │   ├── lifecycle.ts             # cleanup tracking, navigation reset
│   │   │   └── reapply-debouncer.ts     # SPA route changes, tweak edits
│   │   ├── popup/
│   │   │   ├── App.tsx                  # shadcn/ui shell
│   │   │   ├── ExperimentList.tsx       # grouped by author
│   │   │   ├── TweakControls/           # one component per tweak type
│   │   │   │   ├── Toggle.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── NumberSlider.tsx
│   │   │   │   ├── ColorPicker.tsx
│   │   │   │   └── MultiSelect.tsx
│   │   │   ├── ForkDialog.tsx           # fork-from-UI flow
│   │   │   └── main.tsx
│   │   ├── options/
│   │   │   ├── App.tsx                  # API keys, dev toggle
│   │   │   └── main.tsx
│   │   ├── shared/
│   │   │   ├── storage.ts               # typed chrome.storage wrapper
│   │   │   ├── messaging.ts             # typed chrome.runtime.sendMessage
│   │   │   ├── types/
│   │   │   │   ├── manifest.ts          # ExperimentManifest, TweakSchema
│   │   │   │   ├── messages.ts          # MessageType union
│   │   │   │   └── helpers.ts           # LLMHelper, FetchPageHelper
│   │   │   ├── url-match.ts             # glob/regex pattern matcher
│   │   │   └── schema-validators.ts     # Zod schemas for manifest + tweaks
│   │   └── components/ui/               # shadcn primitives (button, dialog, ...)
│   ├── public/
│   │   └── icons/
│   └── package.json
│
├── experiments/                         # Designer-owned, git-tracked experiments
│   ├── designer1/
│   │   ├── weather-card/
│   │   │   ├── manifest.json
│   │   │   ├── experiment.js
│   │   │   ├── description.md           # generated by Cursor
│   │   │   └── presets/
│   │   │       └── default.json
│   │   └── another-exp/
│   ├── designer2/
│   │   └── header-tweak/
│   └── designer3/
│       └── ...
│
├── tools/                               # Build-time helpers
│   ├── build-experiments.ts             # Vite plugin: discover + emit entries
│   ├── manifest-validator.ts            # CLI: validate experiment manifests
│   └── fork-helper.ts                   # CLI used by fork-from-UI flow
│
├── packages/                            # Optional: extract shared types
│   └── experiment-sdk/
│       ├── src/
│       │   ├── types.ts                 # ExperimentApplyArgs, Cleanup, ...
│       │   └── index.ts
│       └── package.json                 # @platform/experiment-sdk
│
├── docs/
│   ├── ONBOARDING.md
│   ├── EXPERIMENT_AUTHORING.md
│   └── HELPERS_API.md
│
├── package.json                         # workspaces: ["plugin", "packages/*"]
└── pnpm-workspace.yaml                  # pnpm workspaces (or npm/yarn)
```

### Structure Rationale

- **`plugin/` as a single Vite project** (not a multi-package app): MV3 demands one cohesive build artifact (`dist/`) with manifest at root. CRXJS expects one Vite root. Splitting popup/SW/content into separate packages adds toolchain pain without runtime benefit. (Confidence: HIGH — this matches CRXJS/Vite conventions.)

- **`experiments/` outside `plugin/src/`**: Keeps designer-edited code separate from engine code. Build pipeline reads `experiments/**` and emits each as a code-split entry that the engine dynamically imports. Lets you `.gitignore` build outputs cleanly and lets designers `cd experiments/me/` without seeing engine internals.

- **`packages/experiment-sdk/`** (optional in v1, recommended by v1.1): TypeScript types for `ExperimentManifest`, `apply()` args, helper interfaces. Designers can import these in their experiment.js for autocomplete in Cursor. Keep as a workspace package so the engine and the SDK share one source of truth.

- **`tools/`**: Build-time scripts (Node, not browser). Critical separation — these never get bundled into the extension.

- **Monorepo (`pnpm` workspaces)**: With `experiments/` as just a directory of "data" (bundled by the build) and `plugin/` as the consumer, this is barely a monorepo — but pnpm workspaces give you `packages/experiment-sdk` for shared types cleanly. (Alternative considered: single-package layout — works fine if you don't extract the SDK.)

---

## Architectural Patterns

### Pattern 1: Service Worker as Single Source of Truth

**What:** All state (enabled experiments, tweak values, ordering, API keys) lives in `chrome.storage.local`, accessed via the SW. Popup and content scripts read/write through the SW (or directly read storage but mutate via SW messages). This avoids race conditions between popup and tab updates.

**When to use:** Always for MV3 extensions with shared state across popup/content/multiple tabs.

**Trade-offs:**
- **Pro:** Single mutation path → predictable state. SW is the only place that subscribes to `chrome.storage.onChanged` and rebroadcasts.
- **Con:** SW can be terminated by Chrome (idle timeout, ~30s). All state must be in storage, never in SW memory. Use storage-as-state, SW-as-orchestrator. (Confidence: HIGH — this is the canonical MV3 caveat.)

**Example:**
```typescript
// Popup mutates via message
await sendMessage({ type: 'EXPERIMENT_TOGGLE', experimentId: 'designer1/weather', enabled: true });

// SW handles
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'EXPERIMENT_TOGGLE') {
    const state = await storage.getEnabledExperiments();
    state[msg.experimentId] = msg.enabled;
    await storage.setEnabledExperiments(state);
    // Notify all matching tabs to re-evaluate
    await broadcastToTabs({ type: 'EXPERIMENTS_CHANGED' });
    sendResponse({ ok: true });
  }
  return true; // keep channel open for async sendResponse
});
```

### Pattern 2: Engine ↔ Experiment Contract (apply + cleanup)

**What:** Every experiment exports a default function `apply(args) → cleanup`. The engine calls `apply()` when the experiment becomes active on a page, stores the returned cleanup, and calls cleanup on disable / navigation / tweak-change-with-reapply.

**When to use:** Always — this is THE engine contract. Without explicit cleanup, disabled experiments leave DOM artifacts, listeners, intervals.

**Trade-offs:**
- **Pro:** Symmetric, simple, testable. Forces designers to think about teardown (which they will forget; document it loudly).
- **Con:** Designers may write incomplete cleanup. Mitigation: provide helpers like `helpers.injectStyle(css)` and `helpers.injectNode(node)` that auto-track for cleanup. See Pattern 3.

**Contract (concrete TypeScript):**
```typescript
// packages/experiment-sdk/src/types.ts

export type Cleanup = () => void | Promise<void>;

export interface ApplyArgs {
  /** Validated tweak values, keyed by tweak.id from manifest */
  tweaks: Record<string, TweakValue>;
  /** Privileged helpers, mediated through the SW */
  helpers: ExperimentHelpers;
  /** The full URL the page is currently on */
  currentURL: string;
  /** Logger scoped to this experiment (shows in popup log panel) */
  log: (level: 'info' | 'warn' | 'error', ...args: unknown[]) => void;
  /** Signal aborted when experiment is being torn down */
  signal: AbortSignal;
}

export interface ExperimentHelpers {
  /** Call configured LLM with prompt; returns text. Counted toward session counter. */
  llm: (prompt: string, options?: LLMOptions) => Promise<string>;
  /** Fetch HTML from URL, optionally extract via selector. Server-rendered only. */
  fetchPage: (url: string, selector?: string) => Promise<string>;
  /** Inject <style> tag, auto-removed on cleanup */
  injectStyle: (css: string) => void;
  /** Inject DOM node into target; auto-removed on cleanup */
  injectNode: (node: Node, target: Element | string) => void;
  /** Wait for selector to exist, with timeout and abort support */
  waitFor: (selector: string, timeoutMs?: number) => Promise<Element>;
  /** Subscribe to URL changes (SPA-aware). Auto-unsubscribed on cleanup. */
  onUrlChange: (cb: (newUrl: string) => void) => void;
}

export type ApplyFn = (args: ApplyArgs) => Cleanup | Promise<Cleanup>;

// experiment.js (designer-authored)
export default async function apply({ tweaks, helpers, currentURL }) {
  helpers.injectStyle(`.weather-card { background: ${tweaks.bgColor}; }`);
  const text = await helpers.llm(`Weather summary in ${tweaks.tone} tone`);
  const node = document.createElement('div');
  node.className = 'weather-card';
  node.textContent = text;
  helpers.injectNode(node, '#search-results');
  // No explicit cleanup needed — helpers track it
  return () => {};
}
```

### Pattern 3: Auto-Tracked Side Effects via Helpers

**What:** The engine builds a per-experiment "side-effect ledger." Helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) push their disposals into the ledger. On cleanup, the engine drains the ledger automatically.

**When to use:** When designers will write apply() — always. Reduces DX friction and prevents leaks.

**Trade-offs:**
- **Pro:** Designers write less cleanup code; engine guarantees teardown for tracked side-effects.
- **Con:** Untracked side effects (raw `addEventListener` on document, plain `setInterval`) still leak. Document these as anti-patterns; provide helper alternatives.

**Example:**
```typescript
// content/engine.ts
function buildHelpers(experimentId: string, signal: AbortSignal): ExperimentHelpers {
  const disposers: Cleanup[] = [];

  return {
    injectStyle: (css) => {
      const el = document.createElement('style');
      el.textContent = css;
      el.dataset.experimentId = experimentId;
      document.head.appendChild(el);
      disposers.push(() => el.remove());
    },
    injectNode: (node, target) => {
      const targetEl = typeof target === 'string' ? document.querySelector(target) : target;
      targetEl?.appendChild(node);
      disposers.push(() => node.parentNode?.removeChild(node));
    },
    llm: (prompt, options) => sendMessage({ type: 'LLM_CALL', prompt, options, experimentId }),
    fetchPage: (url, selector) => sendMessage({ type: 'FETCH_PAGE', url, selector }),
    // ... etc
    [DISPOSE]: async () => { for (const d of disposers) await d(); },
  };
}
```

### Pattern 4: URL-Scoped Re-Apply on Navigation

**What:** Many target sites (ya.ru, modern search) are SPAs — `history.pushState` changes the URL without reloading. Engine must detect URL changes and re-evaluate the experiment set.

**When to use:** Always. Without this, an experiment scoped to `ya.ru/yandsearch` won't apply when user navigates from `/` → `/yandsearch?...` via SPA.

**Trade-offs:**
- **Pro:** Correct behavior on SPAs.
- **Con:** Adds complexity (patch `history.pushState`, listen to `popstate`, debounce). MV3 content scripts run once per document load — they DON'T re-run on SPA nav.

**Example:**
```typescript
// content/engine.ts
function watchUrlChanges(onChange: (url: string) => void) {
  let lastUrl = location.href;
  const check = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onChange(lastUrl);
    }
  };
  window.addEventListener('popstate', check);
  // Patch pushState/replaceState
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (...args) {
      original.apply(this, args);
      queueMicrotask(check);
    };
  }
}
```

### Pattern 5: Privileged Helpers Live in Service Worker

**What:** `llm()` and `fetchPage()` are **proxied through the SW**. Content script's `helpers.llm(prompt)` sends a message to SW; SW makes the actual API call; result returns via response.

**When to use:** Always for these two helpers. Reasons:
1. **CORS**: `fetchPage` from content script is subject to page-origin CORS. From SW, with `host_permissions: ["<all_urls>"]`, CORS is bypassed by extension privilege.
2. **API key safety**: Key never enters page-script context (where target site's JS could read it via prototype pollution / extension fingerprinting).
3. **Cookie isolation**: SW fetches don't carry the user's cookies for target origins (cleaner for fetchPage).
4. **Counter accuracy**: SW counts every LLM call regardless of which tab triggered it.

**Trade-offs:**
- **Pro:** Security, correctness, central rate-limit point.
- **Con:** Extra round-trip latency (~1-3ms in practice — negligible for LLM/network calls). Message size limits: chrome runtime messages have practical ~64MB limit, fine for prompts and HTML. (Confidence: MEDIUM — exact limit not in training data; verify in spike.)

**Example:**
```typescript
// content/helpers.ts
export const llm: ExperimentHelpers['llm'] = async (prompt, options) => {
  return sendMessage({ type: 'LLM_CALL', prompt, options });
};

// background/llm-proxy.ts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'LLM_CALL') {
    callOpenAI(msg.prompt, msg.options).then(sendResponse);
    return true; // async response
  }
});
```

### Pattern 6: Hot-Reload via SW Watcher → Tab Re-Inject

**What:** In dev mode, CRXJS provides HMR for popup/options (via Vite WS). Content scripts and SW are trickier — CRXJS reloads the **whole extension** on file change by default. For per-experiment hot reload, intercept: when an experiment file changes, instead of full reload, send a `RE_APPLY_EXPERIMENT` message; engine cleans up + re-imports + re-applies.

**When to use:** Dev mode only. Production builds are static.

**Trade-offs:**
- **Pro:** Fast iteration: edit experiment.js → save → see change in <1s without re-clicking the toggle or losing tab state.
- **Con:** Dynamic `import()` of a changing module needs cache-busting. CRXJS's WS bridge must reach the content script. (Confidence: MEDIUM — CRXJS does support content-script HMR per their docs as of v2; verify the exact mechanism in spike.)

**Example sketch:**
```typescript
// background/hot-reload.ts (dev only)
import.meta.hot?.on('experiment-changed', async (experimentId: string) => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id!, { type: 'RE_APPLY_EXPERIMENT', experimentId });
  }
});

// content/engine.ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RE_APPLY_EXPERIMENT') {
    cleanupExperiment(msg.experimentId);
    // Cache-bust the import
    importExperiment(msg.experimentId, { bust: Date.now() }).then(applyAgain);
  }
});
```

### Pattern 7: Manifest-Driven Tweak UI Generation

**What:** Tweak schema declared in `manifest.json` drives both (a) the popup UI controls and (b) the runtime `tweaks` object passed to `apply()`. Single source of truth.

**When to use:** Always. Avoids the dual-maintenance trap of "schema in manifest + UI hand-coded in popup."

**Concrete schema:**
```typescript
// shared/types/manifest.ts

export interface ExperimentManifest {
  /** "designer1/weather-card" — derived from folder path, not user-typed */
  id: string;
  /** Human-readable name shown in popup */
  name: string;
  /** Author username (matches folder) */
  author: string;
  /** One-line description for popup */
  shortDescription: string;
  /** URL match patterns (Chrome match patterns + glob extensions) */
  scope: {
    matches: string[];        // e.g. ["https://ya.ru/yandsearch*"]
    excludes?: string[];
  };
  /** Tweak declarations */
  tweaks: TweakSchema[];
  /** Optional: declare which helpers this experiment uses (for visibility) */
  uses?: Array<'llm' | 'fetchPage'>;
  /** Bundle path, populated at build time */
  bundle?: string;
}

export type TweakSchema =
  | ToggleTweak
  | SelectTweak
  | TextInputTweak
  | NumberSliderTweak
  | ColorPickerTweak
  | MultiSelectTweak;

interface BaseTweak {
  id: string;            // key in tweaks object passed to apply()
  label: string;
  help?: string;
}

export interface ToggleTweak extends BaseTweak {
  type: 'toggle';
  default: boolean;
}

export interface SelectTweak extends BaseTweak {
  type: 'select';
  options: Array<{ value: string; label: string }>;
  default: string;
}

export interface TextInputTweak extends BaseTweak {
  type: 'text';
  default: string;
  multiline?: boolean;
  placeholder?: string;
}

export interface NumberSliderTweak extends BaseTweak {
  type: 'number';
  min: number; max: number; step?: number;
  default: number;
}

export interface ColorPickerTweak extends BaseTweak {
  type: 'color';
  default: string;       // hex
}

export interface MultiSelectTweak extends BaseTweak {
  type: 'multiSelect';
  options: Array<{ value: string; label: string }>;
  default: string[];
}

export type TweakValue = boolean | string | number | string[];
```

```jsonc
// experiments/designer1/weather-card/manifest.json
{
  "name": "Weather Card",
  "shortDescription": "Adds an AI-generated weather summary above search results",
  "scope": {
    "matches": ["https://ya.ru/yandsearch*", "https://yandex.ru/search*"]
  },
  "tweaks": [
    { "id": "tone", "type": "select", "label": "Tone",
      "options": [
        {"value": "formal", "label": "Formal"},
        {"value": "casual", "label": "Casual"}
      ],
      "default": "casual" },
    { "id": "bgColor", "type": "color", "label": "Background", "default": "#fff8e1" },
    { "id": "showIcon", "type": "toggle", "label": "Show weather icon", "default": true }
  ],
  "uses": ["llm"]
}
```

---

## Data Flow

### Flow 1: User Enables an Experiment

```
[Popup: user clicks toggle on "designer1/weather-card"]
    ↓
[Popup → SW]   sendMessage({type: 'EXPERIMENT_TOGGLE', id, enabled: true})
    ↓
[SW: orchestrator]
    - Read enabled-set from storage
    - Add id, append to ordering array
    - Write back to storage
    - Query active tabs matching scope patterns
    ↓
[SW → Content Script (each matching tab)]   sendMessage({type: 'APPLY', id, tweaks})
    ↓
[Content Script: engine]
    - import('chrome-extension://.../experiments/designer1-weather-card.js')
    - Build helpers proxy with cleanup ledger
    - Call apply({tweaks, helpers, currentURL, log, signal})
    - Store cleanup handle in active-experiments map
    ↓
[apply() runs]
    - helpers.injectStyle(...) → ledger
    - await helpers.llm(prompt) → message → SW → OpenAI → response
    - helpers.injectNode(...) → ledger
    ↓
[Popup ← SW]   broadcast {type: 'STATE_UPDATED'} → popup re-renders
```

### Flow 2: User Changes a Tweak Value

```
[Popup: user moves slider for "fontSize"]
    ↓
[Popup → SW]   sendMessage({type: 'TWEAK_CHANGE', experimentId, tweakId, value})
    ↓
[SW: orchestrator]
    - Validate value against manifest schema
    - Write to storage (per-experiment tweaks map)
    - Determine policy: re-apply or live-update?
        Default: cleanup + re-apply (simplest, predictable)
        Optional v2: experiment opts in to live-update via a setter
    ↓
[SW → Content Script (matching tabs)]
    sendMessage({type: 'TWEAK_CHANGED', experimentId, tweaks: fullNewMap})
    ↓
[Content Script: engine]
    - cleanup() the experiment (drain ledger)
    - apply({tweaks: newMap, ...}) again
    ↓
[Popup updates: counter, log, etc.]
```

### Flow 3: User Forks an Experiment from UI

```
[Popup: user clicks "Fork to my folder" on designer2/header-tweak]
    ↓
[Popup: open ForkDialog]
    - Ask: target folder name (default = source slug)
    - Ask: which fork strategy? (see options below)
    ↓
[Popup → SW]   sendMessage({type: 'FORK_PREPARE', sourceId, targetFolder})
    ↓
[SW: prepare bundle]
    - Read source manifest.json + experiment.js + description.md from extension's
      bundled experiments registry (these are bundled in the .crx, accessible via fetch)
    - Build a payload: { manifest, experimentJs, descriptionMd }
    ↓
[SW → Popup]   payload returned
    ↓
[ForkDialog: present 3 options]
    Option A — Copy to clipboard (v1, simplest):
        Format as a single block of "create these files" instructions; user pastes
        into Cursor and tells the AI "create these files in experiments/me/<name>/"
    Option B — Download zip (v1+):
        Generate a ZIP via JSZip in popup; user extracts into experiments/me/<name>/
    Option C — GitHub PR via PAT (v2, defer):
        User stores GitHub PAT in options page; popup uses GitHub API to create
        a branch + commit + PR. Higher friction setup, lowest friction per-fork.
    ↓
[User completes the fork outside the extension]
[Designer rebuilds plugin → forked experiment now in their UI]
```

### Flow 4: SPA Navigation Re-Evaluates Experiments

```
[User on ya.ru/, navigates via JS to ya.ru/yandsearch?text=...]
    ↓
[Content Script: history.pushState patch fires]
    ↓
[Engine: onUrlChange handler]
    - For each currently-active experiment:
        does scope still match? → keep running
        no longer matches → cleanup
    - For each not-currently-active enabled experiment:
        scope matches new URL? → apply
    ↓
[DOM updated]
```

### Flow 5: Hot-Reload During Development

```
[Designer: saves experiments/designer1/weather-card/experiment.js in editor]
    ↓
[Vite dev server: detects change]
    ↓
[CRXJS / Vite plugin: rebuilds just that experiment chunk]
    ↓
[Plugin → SW via WS bridge]   { type: 'experiment-changed', id: 'designer1/weather-card' }
    ↓
[SW → Content Script (matching tabs)]   { type: 'RE_APPLY_EXPERIMENT', id }
    ↓
[Engine: cleanup + import (cache-busted) + apply]
    ↓
[Designer sees change in browser, no manual reload]
```

### State Management (Storage Schema)

```typescript
// chrome.storage.local schema
interface StorageSchema {
  // Per-experiment state
  experiments: {
    [experimentId: string]: {
      enabled: boolean;
      tweaks: Record<string, TweakValue>;  // keyed by tweakId
      enabledAt: number;                    // for ordering
    };
  };

  // Order in which experiments are applied (subset of enabled ones)
  experimentOrder: string[];                 // e.g. ["designer1/weather", "designer2/header"]

  // Settings
  settings: {
    llmProvider: 'openai' | 'anthropic';
    llmApiKey: string;                       // user's responsibility
    llmModel: string;                        // e.g. "gpt-4o-mini"
    devMode: boolean;
  };

  // Counters (resets per session — actually stored, refreshed on SW startup)
  session: {
    llmCalls: number;
    llmTokensIn?: number;
    llmTokensOut?: number;
    sessionStartedAt: number;
  };
}
```

---

## Build Order (Phase Implications)

Components have dependencies. Build in this order. **Each level depends on all levels above.**

### Level 0 — Skeleton & Spike (Phase 1)

Goal: prove the core unknowns work.

1. **Vite + CRXJS scaffold** — `plugin/` builds to a loadable unpacked extension
2. **Manifest validator (Zod)** — schema for `ExperimentManifest` and `TweakSchema`
3. **Build-time experiment discovery** — scan `experiments/**`, validate, emit Vite entries, generate `registry.json`
4. **One hardcoded smoke experiment** — `experiments/_smoke/hello-world/` that does `document.body.style.background = 'pink'`
5. **Engine MVP** — content script that reads registry, finds matching experiment for current URL, dynamically imports, calls `apply()`
6. **CRXJS hot-reload spike** — verify content-script HMR actually works for our setup

> **Spike output:** A doc answering "does CRXJS HMR work for content scripts?" If no, document the workaround.

### Level 1 — State & UI Foundation (Phase 2)

Depends on Level 0.

1. **Storage adapter** — typed wrapper, change subscriptions
2. **Messaging bus** — typed sendMessage with request/response
3. **SW orchestrator** — match URL → enabled experiments → broadcast to tabs
4. **Popup shell** (shadcn/ui) — list experiments grouped by author, show toggles
5. **Toggle on/off flow** — popup → SW → storage → content script → apply/cleanup

> **Exit criteria:** Can enable/disable a hardcoded experiment from the popup; cleanup works.

### Level 2 — Tweak System (Phase 3)

Depends on Level 1.

1. **Tweak control components** (one per type: toggle, select, text, number, color, multiSelect)
2. **Auto-rendering** — popup reads manifest, renders controls, binds to storage
3. **Tweak-change → re-apply** flow
4. **Validation** — Zod-validated values entering apply()

> **Exit criteria:** All 6 tweak types render and round-trip through apply().

### Level 3 — Helpers (Phase 4)

Depends on Level 2.

1. **Options page** — API key input, provider select
2. **`llm()` helper** — content script → SW → OpenAI/Anthropic → response
3. **`fetchPage()` helper** — content script → SW → fetch + DOMParser → response
4. **Auto-tracked helpers** — `injectStyle`, `injectNode`, `waitFor`, `onUrlChange`
5. **Session counter** — increment on each LLM call, surface in popup

> **Exit criteria:** A helper-using experiment runs end-to-end on ya.ru.

### Level 4 — DX & Multi-Experiment (Phase 5)

Depends on Level 3.

1. **Hot-reload polish** — non-spike, production-quality dev mode
2. **Multi-experiment ordering** — apply in user-controlled order, persist
3. **SPA navigation handling** — pushState patch, re-evaluate on URL change
4. **Description.md generation** — Cursor prompt + build-time inclusion
5. **Preset save/load** — write tweak values to `experiments/<u>/<id>/presets/*.json`

> **Exit criteria:** Designer iteration loop is fast; multiple experiments compose.

### Level 5 — Distribution & Polish (Phase 6)

Depends on Level 4.

1. **Fork-from-UI** — Option A (clipboard) first, then Option B (zip)
2. **CRX packaging + GitHub Releases** workflow
3. **Onboarding doc** — clone → create folder → run `pnpm dev`
4. **Three-designer end-to-end test scenario**

> **Exit criteria:** Acceptance scenario from PROJECT.md passes.

---

## Anti-Patterns

### Anti-Pattern 1: Storing State in Service Worker Memory

**What people do:** Initialize `let enabledExperiments = ...` at SW top level, mutate in-memory.
**Why it's wrong:** MV3 service workers terminate after ~30s idle. State is lost. (Confidence: HIGH.)
**Do this instead:** Treat SW as stateless; `chrome.storage.local` is the state. Cache only ephemerally inside event handlers.

### Anti-Pattern 2: Eager Loading All Experiments

**What people do:** At engine init, dynamically `import()` every experiment module up front.
**Why it's wrong:** Wastes parse time, runs random JS on every page, makes startup slow.
**Do this instead:** Match URL first, import only matching enabled experiments lazily.

### Anti-Pattern 3: Letting Experiments Touch chrome.* APIs Directly

**What people do:** Designer writes `chrome.storage.local.set(...)` in their experiment.js.
**Why it's wrong:** Couples experiment to the engine's storage schema, breaks isolation, makes refactoring impossible.
**Do this instead:** Helpers + tweaks are the **only** interface between experiments and the platform. If a designer needs persistence, add a helper (`helpers.experimentStorage`) explicitly.

### Anti-Pattern 4: Hand-Coding Tweak UI per Experiment

**What people do:** Each experiment ships its own React component for its settings panel.
**Why it's wrong:** Doubles work, inconsistent UI, ships React per experiment (bundle size), broken hot-reload.
**Do this instead:** Manifest-declared tweak schema + auto-generated UI. Cap expressiveness; if you need a custom UI, you're outgrowing the platform.

### Anti-Pattern 5: Re-Applying on Every Tweak Keystroke

**What people do:** Bind text input directly to `TWEAK_CHANGE` message; every keystroke triggers cleanup + re-apply.
**Why it's wrong:** Janky, especially with LLM calls (you'll fire 10 in 2 seconds).
**Do this instead:** Debounce text/number inputs (250-500ms). Toggle/select/color can be immediate. Make this a property of the tweak control component.

### Anti-Pattern 6: Trusting Designers' Cleanup

**What people do:** Document "please return a cleanup function" and hope.
**Why it's wrong:** Designers will forget. Disabled experiments will leave artifacts. Page reloads will look "stuck."
**Do this instead:** Helper-tracked side effects (Pattern 3). For untrackable cases (raw `addEventListener`), provide `helpers.on(target, event, handler)` that auto-removes.

### Anti-Pattern 7: Scope Pattern Shadowing

**What people do:** Two experiments both match `*://ya.ru/*`; user enables both; they fight over the same DOM node.
**Why it's wrong:** Out of v1 scope per PROJECT.md ("конфликты — на совести дизайнера") — but you should at least surface it.
**Do this instead:** Show in popup: "3 enabled on this page" with order. Per Key Decisions, no conflict resolution in v1, but visibility prevents silent failures.

### Anti-Pattern 8: Letting `apply()` Be Sync-Only

**What people do:** Engine calls `const cleanup = experiment.apply(args)` synchronously.
**Why it's wrong:** Most useful experiments are async (LLM, fetchPage, waitFor selector). Forcing sync makes them write fire-and-forget code.
**Do this instead:** `apply` may return a Promise of cleanup. Engine awaits it. Provide `signal: AbortSignal` so async work can be cancelled mid-flight on disable/navigate.

### Anti-Pattern 9: Treating SPA Navigation Like Reload

**What people do:** Rely on content script's auto-injection at `document_idle` to re-run on URL change.
**Why it's wrong:** Content scripts don't re-run on `history.pushState`. Modern sites are SPAs. Experiments will silently fail on navigation.
**Do this instead:** Pattern 4 — patch `pushState` + `popstate` and re-evaluate.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **OpenAI / Anthropic** | SW makes `fetch()` to `api.openai.com` / `api.anthropic.com`; API key from `chrome.storage.local`. Use streaming false for v1 (simpler). | Need `host_permissions` for these origins in manifest. Counter on every call. |
| **Target sites (ya.ru, etc.)** | Content script via declared `content_scripts.matches`, plus dynamic injection via `chrome.scripting.executeScript` for runtime-enabled tabs. `fetchPage` from SW with `<all_urls>` host permission. | CSP at target site doesn't block extension injection (extension has elevated origin in isolated world). However, target site CSP CAN block `<style>` injection if `style-src` is locked — fall back to inline style attributes. |
| **GitHub (repo)** | Out-of-band: `git clone`, `git push`. Plugin doesn't talk to GitHub in v1 (fork happens manually or via clipboard). | Optional v2: GitHub API + PAT for fork-to-PR flow. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Popup ↔ SW** | `chrome.runtime.sendMessage` (request/response). Popup also `chrome.runtime.connect` for live state subscriptions. | Popup is short-lived (closes on click-away); use storage subscriptions when popup re-opens to re-sync. |
| **Options Page ↔ SW** | Same as popup. | Options page can be longer-lived; still treat SW as source of truth. |
| **SW ↔ Content Script** | `chrome.tabs.sendMessage` (SW → CS, targeting tabId), `chrome.runtime.sendMessage` (CS → SW). | Always include `experimentId` in messages for traceability. |
| **Engine ↔ Experiment** | Direct call: `await experiment.apply(args)`. Experiment imported via dynamic `import()` from bundled URL. | This is THE contract. Stable across versions. |
| **Build pipeline ↔ Experiments** | File system: `experiments/**/manifest.json` discovered via glob. | Build emits one Vite entry per experiment; output goes to `dist/experiments/<author>-<id>.js`. |
| **Engine ↔ Helpers (in CS)** | Direct function call. | Helpers internally use messaging to reach SW for privileged ops. |

---

## Scaling Considerations

This is an **internal tool for a closed team** — "scaling" here means scaling experiments and designers, not users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 designers, ~5 experiments (v1 target) | Current architecture is fine. Single Vite build, registry as static JSON, all experiments bundled. |
| 5-10 designers, 20-50 experiments | Watch bundle size: each experiment is a separate chunk, registry grows. Consider lazy-loading experiment chunks even more aggressively (only fetch on enable, not on registry load). |
| 20+ designers, 100+ experiments | Consider per-author sub-bundles (`dist/experiments/<author>/index.js`) to reduce registry size. May want a "currently-relevant subset" filter at build time (only ship experiments the user has enabled in their `.config`). |

### What Breaks First

1. **First bottleneck:** **Manifest registry size in popup.** Loading 200 manifests + scope patterns to filter "applicable to current URL" is fast (<10ms) but rendering all in popup gets cluttered. Mitigation: search/filter UI, group by enabled-state, virtualized list.

2. **Second bottleneck:** **Bundle size.** With 50 experiments at ~10KB each, that's 500KB shipped (and parsed lazily). Code-splitting + tree-shaking should keep it manageable. Avoid one-big-bundle approaches.

3. **Third bottleneck (organizational, not tech):** **Scope-pattern conflicts** between authors. Surface in UI; don't auto-resolve.

---

## Key Open Questions / Spike Topics

These need empirical validation in Phase 1, NOT guessed-at confidently:

1. **CRXJS content-script HMR**: Does it work out of the box for the engine? For dynamically-imported experiment chunks? — *MEDIUM confidence it does; spike to confirm.*
2. **Dynamic `import()` from extension origin in content script**: Confirm `import('chrome-extension://<id>/experiments/foo.js')` works in isolated world. *HIGH confidence yes (docs explicit), but verify cache-bust mechanism.*
3. **Service worker termination during long LLM calls**: If SW gets killed mid-fetch, what happens to the in-flight call? Mitigation: `chrome.alarms` to keep SW alive during pending requests. *MEDIUM confidence — verify in spike.*
4. **Message size limits**: Sending 1MB HTML from `fetchPage` through SW → CS — does it work or chunk? *MEDIUM confidence — spike with realistic payloads.*
5. **CRX packaging + sideload UX**: Confirm "load unpacked" + "drag-drop CRX" both work for closed team distribution.

---

## Sources

> **External research tools (WebSearch, Context7, official docs fetch) were unavailable for this research pass.** The recommendations above draw on training-data knowledge of:
> - Chrome MV3 architecture (developer.chrome.com/docs/extensions/mv3)
> - CRXJS Vite plugin patterns (crxjs.dev)
> - General browser-extension architecture conventions
> - shadcn/ui component conventions
>
> **Confidence calibration:**
> - HIGH: SW-as-stateless, content-script isolated worlds, `chrome.storage.local` patterns, MV3 manifest structure, message passing semantics
> - MEDIUM: CRXJS HMR for content scripts (rapidly evolving), exact message size limits, SW termination during in-flight fetch
> - LOW: None claimed
>
> **Recommended verification before locking architecture:**
> 1. Read current CRXJS docs at https://crxjs.dev/vite-plugin (especially HMR section)
> 2. Read MV3 service worker lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
> 3. Read `chrome.scripting` API: https://developer.chrome.com/docs/extensions/reference/api/scripting
> 4. Run a 2-3 day spike (Level 0 in Build Order) to empirically validate hot-reload, dynamic import, and message round-trip behavior.

---
*Architecture research for: Designer Experiment Platform (Chromium MV3 extension + bundled-experiment monorepo)*
*Researched: 2026-04-25*
