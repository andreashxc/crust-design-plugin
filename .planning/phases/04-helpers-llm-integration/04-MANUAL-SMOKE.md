---
phase: 04-helpers-llm-integration
smoke_date: 2026-04-26
operator: andrew
automated_gates: passed
manual_status: passed
---

# Phase 4 — Manual MV3 Smoke Record

## Automated Suite Results

| Command | Exit | Notes |
|---------|------|-------|
| `corepack pnpm test -- --run` | 0 | 27 files, 217 tests passed |
| `corepack pnpm typecheck` | 0 | TypeScript project references passed |
| `corepack pnpm lint` | 0 | Passed with 2 existing reduced-motion `!important` warnings (`popup.css`, `options.css`) |
| `corepack pnpm check-csp` | 0 | CSP guard passed |
| `corepack pnpm build` | 0 | WXT Chrome MV3 build passed |

## Build Artifacts

- `apps/extension/.output/chrome-mv3/options.html`
- `apps/extension/.output/chrome-mv3/offscreen.html`
- `apps/extension/.output/chrome-mv3/manifest.json`
- `apps/extension/.output/chrome-mv3/registry.json`
- `apps/extension/.output/chrome-mv3/chunks/experiments-andrew__helper-demo-f920d30d.js`

Manifest checks:

- `name`: `Crust`
- `permissions`: `storage`, `tabs`, `offscreen`
- `action.default_icon`: `icon/16.png`, `icon/24.png`, `icon/32.png`
- `options_ui.page`: `options.html`
- `options_ui.open_in_tab`: `true`

Registry includes:

- `Tweak demo`
- `Smoke pink`
- `Shadow panel`
- `Helper demo`

## Browser-Manual Checklist

### 1. Options page opens

Status: passed

Steps:

1. Reload unpacked extension from `apps/extension/.output/chrome-mv3/`.
2. Open extension details → Extension options.
3. Confirm the page opens in a tab with compact Crust styling.
4. Confirm OpenAI and Anthropic provider rows are visible.

### 2. API key storage and missing-key warning

Status: passed

Steps:

1. Leave both provider keys empty.
2. Open `https://ya.ru/`.
3. Enable `Helper demo`.
4. Confirm the popup shows only an inline missing-key warning on `Helper demo`, not a global banner.
5. Open options, enter an API key for one provider, save.
6. Confirm the warning disappears after reload/retry.

### 3. LLM call, cache, and counters

Status: passed

Steps:

1. With a real OpenAI or Anthropic key saved, enable `Helper demo`.
2. Confirm the injected helper panel appears on ya.ru.
3. Confirm popup LLM session counter increments after the first provider call.
4. Disable/enable or reload within 10 minutes with the same prompt.
5. Confirm cache hit does not increment network call count.

### 4. fetchPage result behavior

Status: passed

Steps:

1. Enable `Helper demo` on a ya.ru page.
2. Confirm no blank helper panel is shown.
3. If a fetched page is an SPA shell or selector cannot be parsed, confirm the helper reports a structured reason instead of silently rendering empty content.

### 5. Cleanup helpers

Status: passed

Steps:

1. Enable `Helper demo`.
2. Confirm injected panel and style exist.
3. Disable `Helper demo`.
4. Confirm the panel/style are removed without manual cleanup code in the experiment.

### 6. Streaming port smoke

Status: deferred

Steps:

1. Trigger a streaming LLM helper call from a local test experiment or devtools harness.
2. Confirm the long-lived `LLM_STREAM` port sends deltas and a final done message.
3. Force-close the port and confirm the failure is explicit, not silent.

## Notes

Manual smoke was performed by Andrew on 2026-04-26 after Phase 4 UI polish:

- Options page accepted a real OpenAI key and model edits persisted.
- Popup showed LLM calls/tokens only after a real call.
- Helper demo injected an in-page result panel on ya.ru.
- Missing-key warning stayed scoped to the affected helper experiment.
- Popup and options followed light/dark system theme.
- Plugin visible name was corrected from `Curst` to `Crust`.
- Toolbar icon now uses the `logo.svg` lightning shape as theme-aware monochrome PNG assets.
- Stale transient dynamic-import errors are cleared on re-arm/successful apply.

The automated stream test covers the port protocol shape. A real >30s provider stream remains deferred to Phase 5/6 acceptance because no long-running provider stream harness exists yet.
