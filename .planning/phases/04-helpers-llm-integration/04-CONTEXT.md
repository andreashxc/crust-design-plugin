# Phase 4 Context: Helpers & LLM Integration

## Phase

**Name:** Helpers & LLM Integration  
**Requirements:** HLP-01, HLP-02, HLP-03, HLP-04, HLP-05, HLP-06, HLP-07, HLP-08, HLP-09  
**Depends on:** Phase 3 Tweak System

## Goal

Ship the helper layer that makes Curst meaningfully different from a normal DOM-mutation userscript runner:

- `helpers.llm(prompt, options?)` calls OpenAI or Anthropic through the background service worker.
- `helpers.fetchPage(url, selector?)` fetches and parses server-rendered HTML through extension context.
- DOM helpers (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) auto-track side effects so experiment authors do not write repetitive cleanup code.
- Cost safety is visible and enforced enough for self-funded API keys: cache, retry limits, session counters, and engine-level apply rate limits.

## Product Decisions

1. **Providers:** Phase 4 ships both OpenAI and Anthropic from the start.
2. **Model selection:** Options page stores a default model id per provider as an editable text field. Avoid hardcoded model dropdowns in v1 because provider model lists change frequently.
3. **Default `llm()` behavior:** `await llm(prompt)` returns a full string by default.
4. **Streaming:** Streaming is explicit through options, not the default helper behavior.
5. **Cost guard:** v1 shows session call/token visibility, warning thresholds, prompt cache, retry limits, max output token defaults, and per-experiment apply rate limiting. It does not promise real budget enforcement.
6. **Missing API key UX:** Popup shows only a small inline warning on LLM-using experiments. No global banner.
7. **Options page style:** Same compact dark Curst/shadcn style as the popup, inspired by the current Codex UI direction. This is a working settings surface, not a marketing page.

## In Scope

- Options page entrypoint with provider key management, provider/model defaults, cost guard settings, cache/session diagnostics.
- Storage schema for provider settings, cost guard defaults, session LLM counters, and prompt cache metadata.
- Background handlers for non-streaming LLM calls, streaming LLM ports, fetchPage requests, cache reads/writes, and diagnostics.
- SDK type expansion for helpers, LLM options/results, fetchPage results, and helper cleanup behavior.
- Content-script helper proxies that keep API keys in the service worker.
- Side-effect ledger for style/node/listener/observer cleanup.
- Reference helper experiment on ya.ru proving `llm`, `fetchPage`, and cleanup helpers.
- Popup integration for session counter and per-experiment inline LLM configuration warning.

## Out of Scope

- Server-side budget enforcement or billing.
- Provider account management beyond links/instructions to set provider-side spend limits.
- Dynamic provider model list fetching.
- Headless rendering or SPA hydration for `fetchPage`.
- Cross-device sync of API keys or settings.
- Public marketplace, backend auth, or shared team key management.

## UX Contract

### Options Page

Options page is opened as an extension page, not a popup replacement. It is for global settings that are too persistent or sensitive for the popup.

Sections:

- **Providers**
  - OpenAI API key password input.
  - Anthropic API key password input.
  - Show/hide affordance per key.
  - Save per provider.
  - Test per provider.
  - Status per provider: not configured, saved, test passed, test failed.

- **Defaults**
  - Default provider selector: OpenAI or Anthropic.
  - Default OpenAI model id text input.
  - Default Anthropic model id text input.
  - Default max output tokens numeric input.

- **Cost Guard**
  - Cache TTL minutes, default 10.
  - Max retry attempts, default 3.
  - Warning threshold for calls per browser session.
  - Per-experiment apply rate-limit interval.
  - Helper text encouraging provider dashboard spend limits.

- **Diagnostics**
  - Current session calls and tokens.
  - Last LLM error.
  - Last provider test result.
  - Clear LLM cache.
  - Reset session counters.

### Popup

Popup remains the fast daily surface:

- Header keeps active experiment count and adds compact LLM calls/tokens display once Phase 4 lands.
- Experiment rows do not show global API-key banners.
- If an experiment declares or uses LLM and the selected provider key is missing, the row shows a small inline warning with an action to open options.
- Existing compact dark style and collapsible tweaks behavior stays intact.

## Technical Constraints

- Content scripts never receive API keys. They send typed helper messages/ports to the service worker.
- Service worker keeps zero required module-scope state. Durable state lives in `chrome.storage.local`; session counters and transient windows live in `chrome.storage.session`.
- Long streaming responses use `chrome.runtime.Port`, not one-shot messages.
- `fetchPage` parsing uses an offscreen document because MV3 service workers have no DOM.
- Helper failures must surface as structured errors and must not break unrelated experiments.
- Rate limiting protects `apply()` and helper calls from MutationObserver or tweak-loop runaways.

## Success Criteria Mapping

- HLP-01: options page stores OpenAI/Anthropic keys; SW-only LLM proxy; content scripts cannot access keys.
- HLP-02: prompt hash cache with storage-backed TTL.
- HLP-03: retry with exponential backoff, max attempts, max output token defaults.
- HLP-04: engine-enforced apply rate limit per experiment.
- HLP-05: popup session counter for calls and tokens.
- HLP-06: `fetchPage(url, selector?)` through SW + offscreen DOMParser.
- HLP-07: structured SPA-shell detection.
- HLP-08: auto-tracked DOM/listener/wait helpers with cleanup ledger.
- HLP-09: streaming LLM over long-lived runtime port.

