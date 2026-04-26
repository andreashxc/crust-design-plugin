# Phase 4 Research: Helpers & LLM Integration

## Summary

Phase 4 should land as a thin privileged-helper layer around the existing Phase 2/3 architecture:

- SDK defines helper types and result unions.
- Content scripts construct helper proxies and side-effect ledgers per experiment.
- Service worker owns provider settings, API keys, provider calls, cache, counters, retries, and fetchPage network access.
- Options page is the global settings surface for sensitive provider/cost configuration.
- Popup only shows session visibility and local inline warnings where an LLM-capable experiment needs configuration.

This preserves the core boundary: experiments can request privileged work, but cannot read API keys or global LLM settings.

## Primary Source Notes

- WXT builds listed entrypoints from `entrypoints/`; `entrypoints/options/index.html` emits `options.html`, and options entrypoints support manifest metadata such as `manifest.open_in_tab` ([WXT entrypoints docs](https://wxt.dev/guide/essentials/entrypoints.html)).
- Chrome MV3 service workers have no DOM; `chrome.offscreen` provides hidden extension documents for APIs like `DOMParser`, and requires the `offscreen` permission ([Chrome offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)).
- OpenAI's current JavaScript path is the official `openai` package and Responses API; non-streaming responses expose aggregated text (`output_text`), and streaming is event-based ([OpenAI JavaScript library docs](https://platform.openai.com/docs/libraries/javascript), [OpenAI streaming guide](https://platform.openai.com/docs/guides/streaming-responses?api-mode=chat&lang=javascript)).
- Anthropic provides an official TypeScript SDK through `@anthropic-ai/sdk` and Messages API usage with `messages.create` ([Anthropic client SDKs](https://platform.claude.com/docs/en/api/client-sdks), [Anthropic messages examples](https://docs.anthropic.com/en/api/messages-examples)).

## Existing Architecture Fit

Current relevant files:

- `packages/experiment-sdk/src/index.ts`: `Helpers` is currently only `{ log }`; Phase 4 should extend it structurally.
- `apps/extension/src/shared/messages.ts`: typed `@webext-core/messaging` protocol is the one-shot message path.
- `apps/extension/entrypoints/background.ts`: top-level message handlers preserve MV3 listener registration timing.
- `apps/extension/src/shared/storage.ts`: local/session storage helpers are centralized and stateless.
- `apps/extension/entrypoints/content-isolated.content.ts`: current reconcile loop owns apply/cleanup and can construct helper objects per experiment.
- `apps/extension/entrypoints/content-main.content.ts`: MAIN-world support is still a stub. Phase 4 helpers should first work for isolated-world experiments; MAIN-world helper bridging can be deferred unless required by a reference experiment.
- `apps/extension/entrypoints/popup/*`: existing compact dark popup and Zustand store can be extended for counters/warnings.

## Data Model

Suggested SDK exports:

- `type LlmProvider = 'openai' | 'anthropic'`
- `type LlmOptions = { provider?: LlmProvider; model?: string; maxOutputTokens?: number; cacheKey?: string; cacheTtlMs?: number; stream?: false }`
- `type LlmStreamOptions = LlmOptions & { stream: true }`
- `type LlmResult = { text: string; provider: LlmProvider; model: string; cached: boolean; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }`
- `type FetchPageResult = { ok: true; url: string; html: string; text: string; title?: string; selector?: string } | { ok: false; url: string; reason: 'network_error' | 'not_html' | 'likely_spa_shell' | 'selector_not_found' | 'too_large'; message: string }`
- `type Helpers` extends with `llm`, `fetchPage`, `injectStyle`, `injectNode`, `waitFor`, `onUrlChange`.

Storage keys:

- `llm:settings` in `chrome.storage.local`: provider keys, default provider, default model ids, cost guard config.
- `llm:cache:<hash>` in `chrome.storage.local`: cached text result + usage + createdAt + expiresAt.
- `llm:last_error` in `chrome.storage.local`: latest provider/helper error for options diagnostics.
- `llm:session` in `chrome.storage.session`: calls, tokens, warning threshold state, last reset time.
- `llm:rate:<experimentId>` in `chrome.storage.session`: recent apply/helper timestamps if not kept in content-script local structures.

## API Key Boundary

Content scripts must not read `llm:settings` directly if it contains keys. Implement one of:

1. Keep `chrome.storage.session.setAccessLevel` broad only for non-secret session keys and never grant content scripts direct access to `chrome.storage.local` secrets.
2. Store provider settings through background handlers and expose only non-secret derived config to popup/options.

Because popup/options are extension trusted contexts, they may save/display masked keys. Content scripts only call:

- `sendMessage('LLM_COMPLETE', { experimentId, prompt, options })`
- streaming via `chrome.runtime.connect({ name: 'LLM_STREAM' })`

## Provider Strategy

Prefer a small internal provider abstraction:

```ts
type ProviderClient = {
  complete(input: NormalizedLlmRequest): Promise<NormalizedLlmResponse>;
  stream(input: NormalizedLlmRequest): AsyncIterable<NormalizedLlmStreamEvent>;
  test(settings: ProviderSettings): Promise<TestProviderResult>;
};
```

This isolates OpenAI Responses vs Anthropic Messages differences:

- OpenAI: `responses.create`, text from `output_text`, usage normalized from response usage.
- Anthropic: `messages.create`, text by concatenating text content blocks, usage normalized from `usage.input_tokens` / `usage.output_tokens`.

Do not expose raw provider response objects to experiments.

## Cache And Cost Guards

Cache key should include:

- provider
- model
- prompt
- max output tokens
- optional `cacheKey`

Hash with Web Crypto (`crypto.subtle.digest`) or a deterministic local helper. Cache TTL default: 10 minutes.

Retry:

- max 3 attempts default
- exponential backoff with jitter
- do not retry obvious configuration errors like missing key or 401
- retry network/429/5xx where provider errors are classifiable

Counters:

- increment calls for network calls, not cache hits
- track cache hits separately if cheap
- token counts use provider usage where available
- popup header shows calls/tokens; options diagnostics can show more detail

## Rate Limiting

HLP-04 is about engine apply safety, not real budget enforcement. Implement content-side `shouldApplyNow(experimentId)` or SW-assisted rate window so repeated MutationObserver/tweak loops do not cause repeated `apply()` and `llm()` calls.

Recommended default: one apply per experiment per 1000 ms, configurable from options. If rate-limited, skip or delay apply with a structured status; do not silently hammer providers.

## fetchPage

Flow:

1. Content helper sends `FETCH_PAGE` message to SW.
2. SW validates URL against extension host permissions / allowed protocols.
3. SW fetches HTML with timeout and size limit.
4. SW sends HTML to offscreen parser or stores large HTML temporarily and passes an id.
5. Offscreen document parses with `DOMParser`, extracts `title`, full text, optional selector HTML/text.
6. Detect SPA shell by heuristics: low text length, high script/low body content ratio, root-only app shells, selector not found.

Need add manifest permission `offscreen`.

Risk: one-shot message payload size for large HTML. Plan should include size cap and tests. If payload is too large, return `{ok:false, reason:'too_large'}` in v1 rather than streaming arbitrary HTML through multiple messages.

## Side-Effect Ledger

Each apply gets a ledger tied to the experiment id and AbortSignal.

Helpers:

- `injectStyle(css, options?)`: creates `<style data-exp-id="...">`, appends to head/root, removes on cleanup.
- `injectNode(node, target?, options?)`: appends/inserts and removes on cleanup if still attached.
- `waitFor(selector, options?)`: uses MutationObserver + timeout + abort integration; disconnects on cleanup.
- `onUrlChange(callback)`: Phase 4 can wrap current URL changes only within page context; full SPA navigation engine remains Phase 5. For Phase 4 helper, register a listener/patch with cleanup and document it as helper-level, not global reapply engine.

Cleanup order should be LIFO.

## Risks

- **SDK in MV3 SW:** provider SDKs may assume Node/browser globals differently. Plan must include a spike/test with actual extension build before deep integration. Fallback: direct `fetch` against provider REST APIs.
- **Streaming keep-alive:** one-shot messages are insufficient for long responses. Use runtime ports and test >30s simulated stream.
- **Secret leakage:** tests must prove content helper output and storage reads never expose key strings.
- **Offscreen lifecycle:** only one offscreen document per profile. Implement ensure/create with concurrency guard and close/keep policy.
- **MAIN world:** current MAIN content script cannot use chrome APIs. Phase 4 reference experiments should stay isolated unless a bridge is explicitly added.

## Test Strategy

- SDK unit tests for type/result helpers and cache-key hash inputs.
- Storage unit tests for settings, masked derived state, counters, cache TTL, diagnostics.
- Provider unit tests with mocked fetch/SDK clients for OpenAI and Anthropic normalization.
- Background handler tests for missing key, cache hit, retry, token counter, clear cache, reset counters.
- Content tests for helper proxy shape, side-effect ledger cleanup, waitFor abort/timeout, rate-limit behavior.
- Offscreen parser tests in jsdom-like unit layer where possible; integration smoke documents real extension parser.
- Popup/options RTL tests for provider forms, diagnostics, inline warning.
- Build test: `options.html` exists, manifest includes `offscreen`.
- Manual smoke: save/test invalid key, configure a real key if available, run reference ya.ru helper experiment, confirm cache hit, counters, cleanup, fetchPage SSR vs SPA-shell behavior.

