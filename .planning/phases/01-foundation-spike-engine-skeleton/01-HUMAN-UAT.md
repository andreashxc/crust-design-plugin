---
status: complete
phase: 01-foundation-spike-engine-skeleton
source: [01-VERIFICATION.md]
started: 2026-04-25T00:00:00Z
updated: 2026-04-25T00:00:00Z
---

# Phase 1 Human UAT

## Current Test

(none — both tests passed in Andrew's live Chrome session 2026-04-25)

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
result: passed (2026-04-25 — after fix `cf6ff10` removed chrome.* call from MAIN world content script; ya.ru toggles cleanly, no errors)
why_human: Roadmap Success Criterion #1 — empirical real-Chrome behavior. All structural prerequisites verified by automated checks; literal apply/cleanup cycle requires Andrew's local Chrome run.

### 2. Service worker survives `chrome://serviceworker-internals` Stop and still applies/cleans up correctly

expected: |

1. With extension loaded and ya.ru open, toggle smoke ON (page pink), then OFF (revert).
2. Open `chrome://serviceworker-internals` → find the extension's SW → click Stop.
3. SW row shows STOPPED.
4. Re-open the popup. Toggle smoke ON again.
5. Page background turns pink again — proves the SW woke from cold start, the top-level `chrome.runtime.onMessage.addListener` fired before `defineBackground` main(), storage was read fresh from `chrome.storage.local`, and `STATE_CHANGED` was broadcast.
6. Toggle OFF → reverts cleanly.
result: passed (2026-04-25 — verified together with Test 1; SW restart + retoggle works as designed)
why_human: Roadmap Success Criterion #5 — explicit manual carve-out per `01-VALIDATION.md` "Manual-Only Verifications". Playwright-driven SW lifecycle automation is deferred to Phase 6 (DIST-03).

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none — both tests passed)

## Issues Caught & Fixed During Manual Smoke

- **content-main.content.ts called `chrome.runtime.onMessage.addListener` in MAIN world** — MAIN-world content scripts have no access to `chrome.*`; the call threw `Cannot read properties of undefined (reading 'onMessage')` at page load. Fixed in commit `cf6ff10` by removing the listener (Phase 1 has no MAIN experiments, so no functional loss). Test gap: `world-routing.test.ts` mocks `chrome.*` globally without distinguishing world contexts, masking this — to fix in Phase 2 either by wiring `runEngine` into the actual content scripts (closes WR-03/04 from code review) or by tightening the chrome mock to throw in MAIN.

## Notes

- Plan 05's checkpoint:human-verify task was auto-approved under chained `--auto` execution (10 [x] checkboxes in `docs/spike/MV3-FOUNDATION.md` reflect that auto-approval, openly disclosed in `01-05-SUMMARY.md` "Human-Verify Outcome" and in the spike doc's "SW Restart Smoke Checklist" preamble).
- Run `/gsd-verify-work 1` after the live Chrome session to record actual results in this file. If anything fails, run `/gsd-plan-phase 1 --gaps` to scope a remediation.
