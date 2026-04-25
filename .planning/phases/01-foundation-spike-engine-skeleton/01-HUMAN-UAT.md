---
status: partial
phase: 01-foundation-spike-engine-skeleton
source: [01-VERIFICATION.md]
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

## Current Test

[awaiting human testing — Andrew runs in real Chrome session]

## Tests

### 1. Load unpacked extension in Chrome and observe ya.ru smoke apply + revert
expected: |
  1. `pnpm -F @platform/extension build` (already green)
  2. `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/.output/chrome-mv3/`
  3. Open `https://ya.ru/` — page renders normally (not pink)
  4. Click extension icon → popup shows "Smoke pink by andrew" with unchecked checkbox
  5. Toggle ON → page background turns pink within ~1-2 seconds (via injected `<style data-exp-id="smoke">`)
  6. Toggle OFF → background reverts cleanly (cleanup removes the style element)
  7. Page DevTools console shows no red errors prefixed `[engine]` or `[exp]`
result: [pending]
why_human: Roadmap Success Criterion #1 — empirical real-Chrome behavior. All structural prerequisites verified by automated checks; literal apply/cleanup cycle requires Andrew's local Chrome run.

### 2. Service worker survives `chrome://serviceworker-internals` Stop and still applies/cleans up correctly
expected: |
  1. With extension loaded and ya.ru open, toggle smoke ON (page pink), then OFF (revert).
  2. Open `chrome://serviceworker-internals` → find the extension's SW → click Stop.
  3. SW row shows STOPPED.
  4. Re-open the popup. Toggle smoke ON again.
  5. Page background turns pink again — proves the SW woke from cold start, the top-level `chrome.runtime.onMessage.addListener` fired before `defineBackground` main(), storage was read fresh from `chrome.storage.local`, and `STATE_CHANGED` was broadcast.
  6. Toggle OFF → reverts cleanly.
result: [pending]
why_human: Roadmap Success Criterion #5 — explicit manual carve-out per `01-VALIDATION.md` "Manual-Only Verifications". Playwright-driven SW lifecycle automation is deferred to Phase 6 (DIST-03).

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

(none yet — both tests are pending Andrew's Chrome run)

## Notes

- Plan 05's checkpoint:human-verify task was auto-approved under chained `--auto` execution (10 [x] checkboxes in `docs/spike/MV3-FOUNDATION.md` reflect that auto-approval, openly disclosed in `01-05-SUMMARY.md` "Human-Verify Outcome" and in the spike doc's "SW Restart Smoke Checklist" preamble).
- Run `/gsd-verify-work 1` after the live Chrome session to record actual results in this file. If anything fails, run `/gsd-plan-phase 1 --gaps` to scope a remediation.
