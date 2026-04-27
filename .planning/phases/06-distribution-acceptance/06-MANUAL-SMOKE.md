# Phase 6 Manual Smoke: Chrome/Yandex Sideload and Acceptance

Use this checklist after `corepack pnpm package:chrome` or after downloading a GitHub Release artifact. Both browser paths verify load unpacked sideloading.

## Build Inputs

| Item | Expected | Result |
|------|----------|--------|
| Unpacked dev path | `apps/extension/.output/chrome-mv3` exists | Pending |
| Release unpacked zip | `crust-chrome-mv3-unpacked.zip` downloads and unzips to `chrome-mv3` | Pending |
| WXT zip | `platformextension-0.0.0-chrome.zip` is attached to the release | Pending |

## Chrome Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select either `apps/extension/.output/chrome-mv3` or the unzipped release `chrome-mv3` folder.
5. Open `https://ya.ru/`.
6. Open the Crust toolbar popup.

| Check | Expected | Result |
|-------|----------|--------|
| Extension loads | Crust icon appears in the toolbar | Pending |
| Registry loads | Popup shows `andrew`, `designer1`, `designer2`, and `designer3` when groups are expanded | Pending |
| No console errors | Extension error page has no new load-time errors | Pending |

## Yandex Browser Load Unpacked

1. Open `browser://extensions` in Yandex Browser. If redirected or unsupported, try `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select either `apps/extension/.output/chrome-mv3` or the unzipped release `chrome-mv3` folder.
5. Open `https://ya.ru/`.
6. Open the Crust toolbar popup.

| Check | Expected | Result |
|-------|----------|--------|
| Extension loads | Crust icon appears in the toolbar | Pending |
| Popup opens | Dark/light theme follows the browser appearance | Pending |
| Registry loads | Acceptance fixture authors are visible | Pending |
| No console errors | Extension error page has no new load-time errors | Pending |

## Acceptance Flow

| Scenario | Steps | Expected | Result |
|----------|-------|----------|--------|
| Fork | Copy fork command for `designer1/acceptance-banner`, replace `<your-author>`, run it in the repo | New folder appears under the target author, `manifest.id` is empty before rebuild, then stamped after dev refresh/build | Pending |
| Composition | Enable `designer1/acceptance-banner` and `designer2/page-summary` on one ya.ru tab, reorder them in popup | Both overlays remain visible with no duplicate DOM nodes or apply-order errors | Pending |
| LLM missing key | Enable `designer3/ai-label` without an API key | Popup shows only the small inline missing-key warning for that experiment | Pending |
| LLM configured key | Add an OpenAI or Anthropic key in options, enable `designer3/ai-label` | Overlay updates with an LLM label and LLM call counter increments | Pending |
| fetchPage | Enable `designer2/page-summary` | Overlay shows fetched page metadata or a clear `fetchPage` reason | Pending |
| Tweaks | Enable `designer1/acceptance-banner`, expand tweaks, change headline/density/accent/timestamp | Overlay updates after each tweak change | Pending |
| Onboarding <15 minutes | Start from a clean clone and follow `docs/ONBOARDING.md` | New user reaches first experiment running in <15 minutes | Pending |

## Notes

- Record browser name, version, OS, and date for each completed run.
- If Yandex Browser blocks sideloaded MV3 behavior differently from Chrome, capture the exact error text and extension error page entry.
