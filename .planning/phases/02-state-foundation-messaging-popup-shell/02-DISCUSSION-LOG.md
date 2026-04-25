# Phase 2: State Foundation, Messaging & Popup Shell — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 02-state-foundation-messaging-popup-shell
**Mode:** `--auto` (Claude selected the recommended option without user input)
**Areas discussed:** Engine Contract, Messaging Bus, Status Model, Auto-Disable Policy, Build Artifacts, Popup UX, Stable IDs & SDK Surface

---

## Engine Contract Hardening (ENG-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock the Phase 1 D-15 contract verbatim and add a TS-only compile-violation test | `apply({tweaks, helpers, currentURL, log, signal}) → cleanup`; testing surface = type-error compile | ✓ |
| Add a runtime Zod validator for `ApplyArgs` | Belt-and-braces but ApplyArgs is internal-only; no need to validate | |
| Loosen the contract (drop `signal`) | Forecloses Phase 4 abortable async helpers | |

**Selected:** Lock verbatim + TS-only test (D-01). Honoring `signal` on cleanup is added as D-02; `helpers` stays minimal `{log}` until Phase 4 (D-03).
**Notes:** Contract was already designed in Phase 1 D-15 to be stable across phases.

---

## Messaging Bus & SW Orchestrator

### Q: Library choice for typed messaging

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt `@webext-core/messaging` | Same maintainer as WXT; typed request/response; eliminates `unknown`-cast boilerplate | ✓ |
| Keep raw `chrome.runtime.sendMessage` + `isExtensionMessage` tag union | Phase 1 shape; zero deps; works | |
| Roll a custom in-house wrapper | DX cost without payoff | |

**Selected:** `@webext-core/messaging` (D-04). Phase 1 `messages.ts` doc-comment already predicted this.

### Q: Phase 2 message catalogue

| Option | Description | Selected |
|--------|-------------|----------|
| `EXPERIMENT_TOGGLE`, `STATE_CHANGED`, `EXPERIMENT_ERROR`, `STATUS_QUERY` | Pull-based status; status flows through storage; SW broadcasts coarse `STATE_CHANGED` | ✓ |
| Above + `STATUS_UPDATE` push | Adds a SW→popup push path; popup must be open to receive | |
| Single uber-message with discriminated payload | Conflates orthogonal concerns (toggle vs error vs query) | |

**Selected:** 4-message catalogue (D-05). Status pull from storage avoids requiring the popup to be open.

### Q: SW orchestrator file shape

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level listener registration in `background.ts`; body delegates to typed handlers in `src/background/handlers/` | Carries SP-7 contract; one file per message type | ✓ |
| Single fat handler file | Loses per-message testability | |
| Class-based orchestrator | Over-architected for 4 messages | |

**Selected:** Split handlers (D-07). Stateless guarantee maintained (D-06).

---

## Status Model (UI-04, UI-08)

### Q: How many status states

| Option | Description | Selected |
|--------|-------------|----------|
| 5 states: `disabled`, `pending`, `applied`, `error`, `auto-disabled` | Distinguishes user intent from engine state from URL match | ✓ |
| 3 states: `off`, `on`, `broken` | Loses the auto-disable visibility ENG-06 demands | |
| 4 states without `pending` | "Toggle on, no matching tab" looks broken | |

**Selected:** 5 states (D-08).

### Q: Source of truth for status

| Option | Description | Selected |
|--------|-------------|----------|
| `chrome.storage` keys + `chrome.storage.onChanged` subscription | Survives SW restart; popup-open-anytime-and-see-truth | ✓ |
| Live SW → popup push | Requires popup open; lossy on storage divergence | |
| Popup queries SW on open | Adds a round-trip; SW must be alive | |

**Selected:** Storage-driven (D-09). Status is *computed* in popup from `enabled` + `autodisabled` + `last_error` + `applied:<activeTabId>` (D-10).

---

## Auto-Disable Policy (ENG-06)

### Q: Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| ≥3 errors in 10 seconds (sliding window) | Mirrors Roadmap success criterion #4 verbatim | ✓ |
| ≥5 errors in 30 seconds | More lenient; lets bad experiments retry longer | |
| ≥3 errors in 60 seconds | Much more lenient; user-visible delay before kill | |

**Selected:** ≥3 in 10s (D-11).

### Q: Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| `autodisabled` map in `chrome.storage.local`; `error_window:<id>` counter in `chrome.storage.session` | Persistent across SW restart; counter resets per browser session | ✓ |
| Both in `chrome.storage.local` | Counter would haunt across browser restart — wrong UX | |
| Both in memory | Violates SP-1 (stateless SW) | |

**Selected:** Split storage (D-12).

### Q: Recovery semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle off → on clears `autodisabled` + counter | Single gesture, uses the toggle the user already understands | ✓ |
| Separate "Re-enable" button under auto-disabled status | Adds UI surface for the same intent | |
| Auto-clear after 5-minute cooldown | Hidden state change confuses users | |

**Selected:** Toggle = re-arm (D-13).

### Q: Visible reason in popup

| Option | Description | Selected |
|--------|-------------|----------|
| Red-outline `Auto-disabled` badge + inline message + click-to-expand stack | Single render path with the regular `error` state | ✓ |
| Modal explaining the disable reason | Disrupts popup flow | |
| Toast notification | Gone after dismissal; popup still has to render the state | |

**Selected:** Inline (D-14). Engine never silently retries (D-15).

---

## Build Artifacts (BLD-03, BLD-04)

### Q: `registry.json` schema

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array of `RegistryEntry` with `{id, author, name, description, scope, world, chunkPath, tweaks}` + SDK `byId()` helper | JSON-natural; preserves sort order; O(1) via helper | ✓ |
| Object map keyed by id | Loses sort-order semantics; harder PR diff | |
| Two artifacts (registry.json + manifests.json) | Duplicates source-of-truth | |

**Selected:** Flat array + `byId()` (D-16).

### Q: Code-split chunk strategy (BLD-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Continue lazy `import.meta.glob('@experiments/*/*/experiment.ts')` + `rollupOptions.output.chunkFileNames` for stable names | Vite already produces one chunk per experiment for free | ✓ |
| Explicit `rollupOptions.manualChunks` per experiment | More config; same outcome | |
| Single bundled experiment file | Loses code-split benefit | |

**Selected:** Lazy glob + stable chunk names (D-17).

### Q: Source-of-truth wiring (registry vs glob)

| Option | Description | Selected |
|--------|-------------|----------|
| Build plugin scans manifests once; emits `registry.json` for popup/SW reads; content scripts continue using `import.meta.glob` for module loaders | Single producer, two consumers, guaranteed consistency | ✓ |
| Virtual module `virtual:experiments` exporting `{registry, loaders}` | Tighter but adds Vite plugin complexity | |
| Pure runtime fetch + `import.meta.glob` composition (no virtual, no shared producer) | Two sources of truth, drift risk | |

**Selected:** Single-producer two-consumers (D-18, D-19).

---

## Popup UX with shadcn (UI-01, UI-03, UI-04, UI-08)

### Q: shadcn components installed in Phase 2

| Option | Description | Selected |
|--------|-------------|----------|
| `Switch, Card, Collapsible, Badge, ScrollArea, Button` | Covers status indicator, author grouping, error UX | ✓ |
| Minimal `Switch + Badge` only | Defers too much to Phase 3 | |
| Full set including `Tooltip, Dialog, Sheet, Toast` | Over-installed; unused components rot | |

**Selected:** 6-component set (D-20).

### Q: Popup layout & author grouping

| Option | Description | Selected |
|--------|-------------|----------|
| `Collapsible` per author, expanded by default if any experiment matches active tab; sorted alphabetically; shows `(n)` count | Matches Phase 6 acceptance scenario visual target | ✓ |
| Flat list with author chip | Loses grouping at 3+ authors | |
| Tabs per author | Consumes vertical space; bad with many authors | |

**Selected:** Collapsible groups (D-21, D-22).

### Q: Status indicator visual

| Option | Description | Selected |
|--------|-------------|----------|
| Colored shadcn `Badge` with text label per state | Color-blind safe (label is redundant); free theme adoption | ✓ |
| Just a colored dot | Loses screen-reader and color-blind affordance | |
| Toggle color reflects status | Conflates intent (toggle) with state (status) | |

**Selected:** Badge with label (D-23).

### Q: Toggle behavior (UI-04)

| Option | Description | Selected |
|--------|-------------|----------|
| `Switch` disabled while SW handler in flight; snap back + inline alert on error | Clear feedback; no toast/dialog overhead | ✓ |
| Optimistic update with no error rollback | Hides backend failures | |
| Confirm dialog on toggle | Excessive friction for a toggle | |

**Selected:** Disabled-while-pending (D-24).

### Q: Error display (UI-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `Collapsible` for expanded stack; short message always visible | Self-contained; no modal | ✓ |
| Hover tooltip for stack | Loses keyboard a11y; doesn't work on touch | |
| Modal/Dialog | Disrupts popup; overkill | |

**Selected:** Inline expand (D-25).

### Q: Active-tab URL awareness

| Option | Description | Selected |
|--------|-------------|----------|
| Show all experiments; status reflects active tab URL match (`pending` vs `applied`) | UI-05 (filter to URL) is Phase 3 | ✓ |
| Filter rows to active tab URL only | Leaves Phase 3 with nothing to do | |
| Toggle button to filter | New control surface; no current ask | |

**Selected:** Show all, status reflects URL (D-26).

### Q: State management library

| Option | Description | Selected |
|--------|-------------|----------|
| Zustand single store with slices | Phase 1 D-04 already locked Zustand; no boilerplate | ✓ |
| React `useState` + Context | Re-render perf bad with many sliders (Phase 3 incoming) | |
| TanStack Query | Overkill for local state; defer to v2 sharing | |

**Selected:** Zustand store (D-27).

### Q: Options page in Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 4 | API-key UI is the trigger; nothing to put on options page in Phase 2 | ✓ |
| Stub options page | Adds maintenance for empty surface | |
| Full options page | No P2 features need it | |

**Selected:** Defer (informs D-20 component set; popup-only).

---

## Stable IDs & SDK Surface (MAN-03, MAN-04)

### Q: Storage-key shape

| Option | Description | Selected |
|--------|-------------|----------|
| Every per-experiment key keyed by ULID; reserve future `tweaks:<ulid>` and `preset:<ulid>:<name>` shapes | Closes MAN-03; no migration when Phase 3/5 land | ✓ |
| Keys by folder path | Breaks on folder rename — exactly what MAN-03 forbids | |
| Mixed (some by path, some by ULID) | Inconsistent; harder to audit | |

**Selected:** All ULID-keyed (D-28). Migrates Phase 1 `last_error:<id>` to a single `last_error` map (D-29).

### Q: SDK type exports for MAN-04

| Option | Description | Selected |
|--------|-------------|----------|
| Add `RegistryEntry, Registry, ExperimentStatus, ErrorRecord, AutoDisableRecord, byId` next to existing `ApplyFn`/etc. | Single import source for designers; closes MAN-04 | ✓ |
| Keep status types inside the extension app | Designer experiments don't see them; UX worse for Phase 5 | |
| New `@platform/extension-types` package | Premature splitting | |

**Selected:** Add to existing SDK (D-30, D-31). Stays zero-runtime except `byId`.

---

## Claude's Discretion

These were intentionally not turned into discussion questions in `--auto` mode — they are pure-implementation choices logged in CONTEXT.md `### Claude's Discretion`:

- Internal file layout under `apps/extension/src/background/handlers/`.
- Zustand action naming.
- shadcn theme palette (default `slate`).
- Storage migration's idempotency strategy (every-wake vs one-time).
- Whether to extract a `useExperimentRow` hook.
- Test layout (Vitest, co-located, mirroring Phase 1).

## Deferred Ideas

Captured in `02-CONTEXT.md` `<deferred>` section:

- Options page (Phase 4)
- Tooltip / Dialog / Sheet / Toast components (Phase 3+)
- URL-filtered popup view (Phase 3 / UI-05)
- Drag-and-drop reorder (Phase 5 / ENG-09)
- Search by name/author (Phase 5 / UI-06)
- Toolbar badge count (Phase 5 / UI-07)
- Hot-reload `RE_APPLY_EXPERIMENT` (Phase 5 / DX-01)
- SPA navigation re-eval (Phase 5 / ENG-07)
- MutationObserver guard (Phase 5 / ENG-08)
- `chrome.storage.sync` cross-device (v2)
- Per-experiment health telemetry (Phase 5 / v2)
- Yandex Browser smoke (Phase 6 / DIST-03)
- `.crx` rebuild + GitHub Releases (Phase 6 / DIST-01)
- Tweak storage values (Phase 3 / TWK-07)
- Preset save/load (Phase 5 / TWK-08)

### Considered, then explicitly NOT chosen
- Push-style status updates (rejected D-09)
- In-memory error window in SW (rejected D-12 — violates SP-1)
- Custom message-bus wrapper (rejected D-04)
- Object-map `registry.json` (rejected D-16)
- Auto-clear cooldown for auto-disable (rejected D-13)
