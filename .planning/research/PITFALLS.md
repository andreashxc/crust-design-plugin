# Pitfalls Research

**Domain:** Chromium MV3 browser extension as a designer-experiment platform (DOM mutation, tweak UI, LLM/fetchPage helpers, sideload distribution)
**Researched:** 2026-04-25
**Confidence:** MEDIUM-HIGH (based on training-data knowledge of MV3 + CRXJS/Plasmo ecosystem through January 2026; external verification via WebSearch/WebFetch was unavailable in this session — items marked LOW where claims are most likely to drift)

> **Source-availability note**
> WebSearch, WebFetch, and Bash-based search were all denied during this research session, so no live URLs were verified. The findings below come from Claude's training data through January 2026, which covers MV3 stabilization, the CRXJS 2.x line, Plasmo, and the major MV3 migration write-ups. Anything dependent on Chrome version-specific behavior (e.g., service-worker idle timer values, current `chrome.scripting` flags) should be re-verified with `chrome://version` and `https://developer.chrome.com/docs/extensions` during Phase 1 spike work. Where a specific behavior could plausibly have changed since 2025-Q4, the item is marked LOW confidence.

---

## Critical Pitfalls

### Pitfall 1: Treating the MV3 service worker like a long-lived background page

**What goes wrong:**
The team writes the LLM proxy / `fetchPage` helper / "extension state" into module-scope variables in the service worker (`let cache = new Map()`, `let pending = []`, `const ws = new WebSocket(...)`). It works perfectly during dev — the SW stays alive while devtools are open. In real use the SW is terminated after ~30 seconds idle, all module state is wiped, in-flight `fetch()` is aborted mid-stream, the WebSocket dies, and the next message from the popup or content script wakes a *fresh* SW that knows nothing.

Symptoms: "the LLM call sometimes returns empty," "tweak values randomly disappear," "the experiment fires twice on the same page," "fetch hangs forever and never resolves."

**Why it happens:**
Service workers in MV3 are event-driven, not persistent. Chrome aggressively kills them to save memory. Devtools artificially keeps them alive, so the bug is invisible during development. Anyone with MV2 muscle memory writes background-page code by reflex.

**How to avoid:**
- Treat the SW as **stateless between events**. All state lives in `chrome.storage.local`, `chrome.storage.session`, or `IndexedDB`.
- Re-register listeners (`chrome.runtime.onMessage`, `chrome.alarms.onAlarm`, etc.) at the **top level of the module**, not inside `chrome.runtime.onInstalled`. Top-level listeners are what wakes the SW; listeners attached lazily are silently lost on the next cold start.
- Use `chrome.alarms` (minimum 30s in production, 1s with `--debug-packed-extensions`) for periodic work — never `setInterval`.
- For long-running tasks (LLM streaming, slow `fetchPage`), use `chrome.runtime.connect()` long-lived ports — Chrome keeps the SW alive while a port is open, but **only up to 5 minutes**, after which the port is force-closed.
- Wrap LLM/fetch helpers in a "wake → do work → return" envelope; never assume earlier in-memory state.

**Warning signs:**
- Manual test "leave the browser tab open for 1 minute, then trigger the experiment" reproduces only intermittently
- `console.log` in the SW shows the SW being torn down (Chrome explicitly logs `Service worker stopped`)
- State that "should be cached" is recomputed every time
- Listeners registered in async callbacks (e.g. inside `await initStorage(); chrome.runtime.onMessage.addListener(...)`) — these are dead after restart

**Phase to address:** Engine / SW architecture phase. Pick the storage layer (chrome.storage vs IDB) on day one — retrofitting is painful because every feature accumulates SW-state assumptions.

**Severity:** **Critical**

---

### Pitfall 2: MV3 CSP forbids `eval`/inline scripts/remote code — designed-in violations break extension at load time

**What goes wrong:**
Designer writes an experiment that uses `new Function(userPrompt)`, or uses a library that ships a Function-based template engine (lodash `_.template`, older Vue runtime, AlpineJS expressions, some chart libs), or attempts `import("https://cdn.../module.js")`. The extension either:
1. Refuses to load (`'unsafe-eval' is not an allowed source` in manifest CSP)
2. Loads, but the experiment silently fails with a CSP violation in console
3. Passes Chrome MV3 review (in-store) only to be rejected for "executing remote code"

Specific to this project: the LLM helper might be tempted to `eval()` returned code, or the experiment might want to dynamically `import()` a small utility from JSDelivr to avoid bundling. Both are forbidden.

**Why it happens:**
MV3 hard-bans `unsafe-eval` and remote code execution as a security architecture decision. Many JS libraries assume `Function` is available. The error messages are non-obvious (CSP violations land in different consoles depending on context — page console, extension console, or service worker devtools).

**How to avoid:**
- Codify the rule in the experiment authoring docs: **no `eval`, no `new Function`, no remote `import()`, no `<script src="https://...">` injection**. If a designer needs a library, it must be bundled.
- Pre-flight every experiment at build time with a CSP-violation linter (`eslint-plugin-security` covers `eval`/`new Function`; custom rule for dynamic imports of remote URLs).
- For LLM output that the experiment wants to "run as code" — don't. Restrict LLM helpers to **returning data** (HTML strings, JSON, plain text). The experiment renders/applies that data; it doesn't execute it.
- Do **not** add `'unsafe-eval'` to manifest CSP as an escape hatch. Even if it loads in dev, it permanently disqualifies the extension from Web Store distribution if you ever want it later, and it punctures the trust model with the page.
- Audit shadcn/ui, Tailwind, and any dependency for `Function` usage at bundle time. Most modern libraries are CSP-safe, but check.

**Warning signs:**
- Console warning: `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script`
- A library "works in the dev server but not in the loaded extension"
- `chrome.runtime.lastError = "Cannot use 'unsafe-eval' in this context"`
- An experiment that builds dynamic templates from string concatenation + `Function`

**Phase to address:** Engine + experiment-authoring contract phase. Make the "no eval / no remote code" rule a CI check before a single experiment ships.

**Severity:** **Critical**

---

### Pitfall 3: Wrong execution world — experiments need `MAIN` to access page state but get isolated by default

**What goes wrong:**
A designer writes an experiment for ya.ru that needs to read `window.__YA_STATE__` (a page-level global the SPA exposes), or to call a page-defined function like `window.YandexSearch.refresh()`, or to read a React fiber off a DOM node to extract data not visible in the rendered DOM. In the default isolated content-script world, `window` is a separate JS realm — page globals are invisible, page event listeners can't be patched, and React internals aren't reachable.

Conversely, an experiment runs in `world: "MAIN"` and tries to call `chrome.storage.get()` to read a tweak value — this throws because `chrome.*` APIs are only exposed in the isolated world.

**Why it happens:**
The dual-world model is poorly explained. `world: "MAIN"` was added in Chrome 95 for content scripts; many tutorials still describe the old "inject a `<script>` tag with the source code" workaround. The team picks one world and tries to do everything in it.

**How to avoid:**
- Architect **two-tier execution**: a thin isolated-world "host" content script that owns `chrome.*` APIs, postMessage bridge, and state; experiment code that needs page access runs in `world: "MAIN"` via `chrome.scripting.executeScript({world: "MAIN", ...})` or via a `<script>` element appended to the page (only with `web_accessible_resources` declared).
- The `apply({tweaks, ...})` API should be **callable from either world** — the engine routes calls. Document clearly: "if you need `window.something` from the host page, declare `worlds: 'MAIN'` in your experiment's manifest."
- For passing data between worlds: `window.postMessage` (page world ↔ isolated world) or `CustomEvent` with a known name. Never expose `chrome.runtime` to the page world directly.
- Test every helper (`llm`, `fetchPage`, tweak read/write) **explicitly from the MAIN world** and from the isolated world. They behave differently.

**Warning signs:**
- `Uncaught TypeError: Cannot read properties of undefined (reading 'storage')` from an experiment trying to use `chrome.storage` — the experiment is in MAIN
- `window.someGlobal is undefined` from an isolated experiment that "should see it"
- Experiment works in devtools console (which runs in MAIN) but not when triggered via the engine
- Two experiments on the same page see different `window` objects

**Phase to address:** Engine architecture phase. The execution-world model is a foundational decision; rework cost is high.

**Severity:** **Critical**

---

### Pitfall 4: SPA re-renders wipe out experiment DOM mutations

**What goes wrong:**
An experiment injects a `<div class="video-overview">` over the Yandex search results on initial page load. User scrolls/paginates/types a new query — the SPA re-renders the results list, and the injected block vanishes. Or the page is mostly server-rendered but a hydration step rewrites the children, removing the experiment's edits. The experiment "works once, then disappears."

Worse: re-running `apply()` on every change without a stable identity key produces **duplicate** injections.

**Why it happens:**
- Single-page apps (Yandex's outer chrome, internal navigation) replace DOM subtrees without a full page reload. `document_idle` content scripts run once; they never know the page changed.
- React/Vue/etc. reconciliation removes nodes whose virtual-DOM key it doesn't recognize.
- MutationObserver, used naively, fires on the experiment's *own* mutations — causing re-apply loops.

**How to avoid:**
- The engine provides a **lifecycle contract** to experiments: `apply()`, `cleanup()`, and `shouldReapply(mutations)`. The engine, not the experiment, owns observation and re-application.
- Use a single shared `MutationObserver` per page, scoped to a meaningful root (often `document.body` is too coarse — try the SPA's mount node). Debounce callbacks (e.g., 50–100 ms idle) so a render burst is one re-apply.
- Tag injected nodes with `data-exp-id="<author>/<experiment>"`. On re-apply, check existence first — `if (document.querySelector('[data-exp-id="..."]')) return;` — to avoid duplicates.
- **Filter out self-mutations**: when the engine applies a change, set a flag for the next microtask so the observer ignores its own writes.
- For `history.pushState`-driven SPA navigation (Yandex uses this), monkey-patch `pushState`/`replaceState` and listen to `popstate` — `MutationObserver` alone doesn't tell you "the URL changed."
- Provide URL-pattern re-evaluation: when the URL changes within scope, re-run scope match → call `apply()`/`cleanup()` accordingly.

**Warning signs:**
- Experiment works on first load but disappears after pagination
- Two copies of the injected block stacked on each other
- Browser tab CPU at 100% (re-apply loop)
- "Maximum call stack exceeded" in the engine code (recursive observer fire)

**Phase to address:** Engine — DOM application & lifecycle phase. This is the engine's core responsibility; doing it wrong is the difference between a useful tool and one designers immediately abandon.

**Severity:** **Critical**

---

### Pitfall 5: Tailwind preflight + shadcn/ui injected into a content script destroys the host page's styling

**What goes wrong:**
The plugin's UI uses Tailwind + shadcn/ui. A content script needs to render an in-page panel (e.g., a tweak editor that the designer can keep open while iterating on a live page). The content script imports `tailwind.css` and injects it via `<link>` or `<style>` into the page. Tailwind's **preflight** ships rules like `*, ::before, ::after { box-sizing: border-box; border: 0 solid; }`, `h1 { font-size: inherit; font-weight: inherit; }`, `img { display: block; }`, etc. — applied **globally**.

Result: the host page (ya.ru) suddenly has its own headings reset to inherit, its layout breaks, images behave differently. The designer's experiment now interferes with the very page they were trying to non-destructively tweak.

**Why it happens:**
Tailwind preflight is intentionally global — it's a CSS reset. There is no built-in scope. Most tutorials assume Tailwind is the only CSS on the page. shadcn/ui depends on Tailwind being properly configured and adds its own CSS variables (`--background`, `--foreground`, etc.) at `:root`, which can collide with the host page's theme variables.

**How to avoid:**
- Render **all in-page UI inside a Shadow DOM** root. The content script attaches a host `<div>` with `attachShadow({mode: 'open'})` and renders the React tree inside. Tailwind styles go into the shadow root via a `<style>` element or constructable stylesheet — they cannot escape into the host page.
- Disable Tailwind preflight for the content-script bundle (`corePlugins: { preflight: false }` in `tailwind.config.js`) — *or* keep it but only inside the shadow root (preferred).
- For shadcn/ui specifically: the CSS variables it defines on `:root` need to be scoped to the shadow root's host element instead. Patch the generated CSS at build time, or override the variables on `:host`.
- The **popup** (and options page) UI is fine with normal Tailwind — those run in their own document, no host page conflict.
- Beware `position: fixed`/`z-index` collisions with the host page. Test on the busiest target (Yandex search) — these pages stack many overlays.

**Warning signs:**
- Host page headings change size/weight after extension loads
- Host page form controls suddenly look different
- shadcn/ui colors look "wrong" in the in-page panel (host's CSS variables bleed in)
- Browser console shows "duplicate CSS variable" or styles "fighting" via specificity

**Phase to address:** UI / content-script-UI phase. Decide on Shadow DOM isolation **before** writing any in-page panel code; switching later means rewriting the renderer.

**Severity:** **Critical** (on the in-page panel scope; popup UI is fine)

---

### Pitfall 6: API key for LLM stored in extension is recoverable by anyone with devtools

**What goes wrong:**
The plugin stores the user's OpenAI/Anthropic API key in `chrome.storage.local` and uses it to call provider APIs from the service worker. The team treats this as "private" because it's "the user's local extension." But:
- Anyone with access to the user's profile directory can read storage (it's a SQLite/LevelDB file on disk, unencrypted).
- A malicious experiment running in MAIN world cannot read it directly, but the engine that calls `llm()` can be subverted if any other experiment compromises the engine state.
- If experiments are checked into git and one experiment accidentally `console.log`s the key (or `fetchPage`s a URL with the key in a query param), it's leaked.
- A key shared "for testing" via Slack ends up screenshotted, etc.

**Why it happens:**
"Closed team" makes the team feel safe. "It's just a personal key" makes spend feel bounded — but a buggy retry loop can burn $100 in minutes on Claude Opus, and a leaked key on the wrong network can be exploited within hours.

**How to avoid:**
- Treat the key as a **secret**, even in a closed team:
  - Never log it. Never include it in error messages. Never accept it in URL query params (use `Authorization` header only).
  - Restrict access: only the SW touches the key. Content scripts call the SW via message passing; the SW does the request. Experiments never see the key.
  - Spending controls in code: a per-session token counter visible in the popup; a configurable hard cap (e.g., 50 calls / session, 100k tokens / day) that the SW enforces.
  - Recommend per-key spend limit on the provider dashboard (OpenAI and Anthropic both support this).
- Lint experiment code at commit time for `process.env.OPENAI` / `apiKey` / `Bearer sk-` patterns to catch accidental commits.
- Document the threat model explicitly: "your key is on your machine; if your machine is compromised, so is the key." Don't oversell isolation.
- For shared keys: don't. Each user has their own; the cost stays per-user.

**Warning signs:**
- API key visible in `chrome.storage` viewer (Storage Explorer extension)
- `fetch` calls in network tab with `?api_key=...` in URL
- `console.log` lines that interpolate the auth header
- A retry loop without exponential backoff or max-retries

**Phase to address:** LLM helper / security phase. Key-handling architecture should land before the helper is wired to any experiment.

**Severity:** **Critical** (security + financial)

---

### Pitfall 7: Cost runaway from experiment loops calling `llm()` without budget guard

**What goes wrong:**
Designer writes an experiment that re-applies content on every MutationObserver fire and calls `llm()` inside `apply()`. SPA re-renders 50× during a page session → 50 LLM calls → $5 per page view. Or the experiment retries on failure with no backoff and the API is rate-limited, so it loops indefinitely. Designer browses normally for an hour and burns $200.

A more subtle variant: streaming responses are aborted mid-stream by SW shutdown (Pitfall 1) and the experiment doesn't realize it; it issues a fresh request that also gets aborted; no work is ever done, but every aborted request still counts toward spend.

**Why it happens:**
LLM calls feel free during development with small prompts. Production target is Yandex SERPs, which the designer reloads dozens of times. The cost surface is invisible until the monthly bill arrives.

**How to avoid:**
- The `llm()` helper enforces:
  - **Cache by prompt hash** (default on, opt-out per call). Identical prompts within 10 minutes return cached result for free.
  - **Per-session token counter**, visible in the popup. Hard cap on session spend (default e.g. $1 / 24h / experiment, configurable).
  - **Retry policy with exponential backoff**, max 3 attempts; surface failures to the designer, never silently retry.
- The engine throttles `apply()` calls: if `apply()` is invoked >N times in T seconds, log a warning to the designer and skip. Default e.g. 5 calls / 10s.
- LLM calls **must** be initiated outside hot paths. Engine emits a console warning if `llm()` is called inside a MutationObserver callback without a debounce wrapper.
- Tweak-driven re-apply: when the designer changes a tweak, the experiment re-applies — but call `llm()` only if the prompt actually changed. The helper API: `llm(prompt, {key: stableId})` — same key + same prompt = cached.
- Provider-side: enforce monthly spend cap on the API key dashboard. This is the last-resort circuit breaker.

**Warning signs:**
- Token counter increments during page scroll (it shouldn't)
- Cost-per-tab notably higher than cost-per-experiment-execution
- Provider dashboard shows hundreds of identical prompts back-to-back
- Designer reports "the experiment keeps reloading"

**Phase to address:** LLM helper phase. Budget guards and caching are part of the v1 helper contract — do not ship `llm()` without them.

**Severity:** **Critical** (financial)

---

### Pitfall 8: A single experiment's uncaught error breaks every other experiment on the page

**What goes wrong:**
Designer A's experiment throws `TypeError: Cannot read property 'foo' of null` from inside `apply()`. The engine, naively, runs experiments in a single try-less loop, so the error propagates and Designer B's and C's experiments on the same page never run. Or the experiment throws inside a `MutationObserver` callback; the observer is registered globally and now no experiment receives mutation events.

Worse: an infinite loop or `while(true)` inside an experiment freezes the entire tab. Since content scripts run in the page's main thread, the page becomes unresponsive — including the close-tab button briefly.

**Why it happens:**
Experiments are written by designers, not engineers. They're untested by anyone but the author. Bug-on-some-pages is normal. A pure JS module API offers zero guardrails.

**How to avoid:**
- The engine **wraps every experiment** in `try/catch` — both `apply()` and `cleanup()`, and any callback the engine invokes on the experiment's behalf (mutation handlers, event handlers).
- Errors are reported to the popup ("Experiment X errored on this page — click to see stack trace") and to a session-local error log, but **do not break other experiments**.
- A misbehaving experiment is **auto-disabled for the current page after N errors** (e.g., 3 errors / 10s) until the designer reloads.
- For infinite loops: the engine tracks `apply()` execution time. If `apply()` takes >2s synchronously, log a warning. If >5s, kill the page (`window.stop()`) and flag the experiment. (Note: this only catches synchronous loops; async loops are different — see Pitfall 9.)
- Enforce a code review checklist for experiments: no `while(true)` without a break condition, no recursion without depth limit, no synchronous network/heavy work.
- Encourage TypeScript for experiments — the type-checker catches a class of "undefined access" bugs at commit time. Provide `apply` signature types in the engine SDK package.

**Warning signs:**
- Popup shows zero experiments running on a page where many are enabled
- `Uncaught (in promise)` floods the console
- Browser shows "Page unresponsive — kill?" dialog
- Experiments work in isolation but break when combined

**Phase to address:** Engine — error isolation phase. Build the sandbox-by-try-catch wrapper around the very first `apply()` call.

**Severity:** **Critical**

---

### Pitfall 9: Infinite mutation observer loops freeze the browser

**What goes wrong:**
Experiment registers a `MutationObserver` on `document.body` looking for "new search results to enrich." When it sees one, it injects a `<div>`. The injection itself is a mutation, fires the observer, which sees a new node, tries to enrich it, injects another `<div>`… browser tab pegs CPU at 100% and becomes unresponsive in <500 ms.

A subtler variant: the observer is fine, but a CSS rule the experiment injects causes a layout that triggers a JS event in the host page that mutates the DOM that triggers the observer that re-injects the CSS — a cross-system feedback loop.

**Why it happens:**
MutationObservers don't filter their own caller's mutations. Designers don't realize that "responding to a mutation by mutating" is the canonical infinite-loop pattern. There is no built-in safeguard.

**How to avoid:**
- Engine provides a **wrapped observer API** to experiments:
  ```js
  ctx.observe(target, callback, options);
  ctx.applyMutation(() => { /* mutating code */ });
  ```
  The wrapped `applyMutation` sets a flag that causes the next observer fire to be ignored.
- All injected nodes carry `data-exp-id="..."`. The engine's filter discards observer entries whose target/added-node has that attribute.
- Engine enforces a **mutation-rate circuit breaker**: if any single experiment causes >100 mutations in <1s via the wrapper, the engine kills the experiment for the page and notifies the designer.
- Discourage `subtree: true` observers on `document.body` — recommend a more specific root. Document this in the experiment authoring guide with examples.
- In dev mode, the engine's `applyMutation` traces who-called-whom so a loop is visible in console as a stack-style log.

**Warning signs:**
- Tab CPU at 100%, fan spinning
- Memory ramp visible in `chrome://memory-internals`
- Console flooded with the same log line
- Page becomes unresponsive seconds after experiment activates

**Phase to address:** Engine — observer/lifecycle phase. The wrapped-observer pattern is core to the safety story.

**Severity:** **Critical**

---

## Important Pitfalls

### Pitfall 10: Selectors targeting hashed class names (`.btn-primary-2x9bA`) break on every redeploy

**What goes wrong:**
Designer builds an experiment for ya.ru by inspecting the DOM, copying the `.css-1abcd2e` class from a button, and using it as a selector. Yandex deploys a CSS-modules build the next day; the class becomes `.css-9zyx8w`. Experiment silently no longer matches anything.

**Why it happens:**
Modern sites use CSS Modules / styled-components / atomic CSS — class names are content-hashed and change on every build. They are not stable identifiers.

**How to avoid:**
- Document a selector hierarchy in the experiment authoring guide:
  1. **Best**: ARIA roles, `data-*` attributes, `name` attributes, semantic tags (`main`, `article`).
  2. **OK**: text-content matchers (`:has-text(...)` via the engine, since native CSS `:has-text` doesn't exist).
  3. **Risky**: structural selectors (`main > div:nth-child(2) > section`).
  4. **Avoid**: hashed class names.
- Engine provides selector helpers: `ctx.findByText`, `ctx.findByAttribute`, `ctx.findStable(...)` — encourages stable patterns.
- Build a "selector linter" into the experiment build that flags class names matching `/[a-zA-Z]+-[a-z0-9]{4,}$/` (heuristic for hashed) and warns.
- Each experiment can declare an **expected-DOM smoke check**: a function that returns true if the page still looks like what the experiment expects. Run on apply; warn the designer if false.

**Warning signs:**
- Experiment works for a week, breaks silently
- "Find by selector returned 0 nodes" in engine log
- Designer reports "I tested this yesterday and now it doesn't work"

**Phase to address:** Experiment authoring SDK / linting phase.

**Severity:** **Important**

---

### Pitfall 11: First-paint timing — content script runs after the SPA has already rendered (or before the DOM exists)

**What goes wrong:**
Content script declared as `run_at: "document_idle"` (default) → runs after the page is fully loaded; experiment paints visibly *after* the user already sees the page → flicker / pop-in. Or `run_at: "document_start"` → runs before the body exists, `document.querySelector('main')` returns null, experiment fails.

For SPA navigations within the page, content scripts don't re-fire at all (Pitfall 4) — first-paint is only relevant on initial load.

**Why it happens:**
The four `run_at` modes trade off "DOM available" against "before user sees page." None is right for all experiments. Designers default to `document_idle` and live with flicker.

**How to avoid:**
- Engine declares content scripts at `document_start` and exposes a small lifecycle:
  - `ctx.whenReady(selector, callback)` — resolves when the selector exists, polls efficiently with a fast MutationObserver scoped to the closest available ancestor.
  - `ctx.preApply(cssToInjectImmediately)` — synchronous CSS-only changes can hide/restyle before paint, even at document_start.
- Experiments default to `document_end` semantics for `apply()`: the engine waits for `DOMContentLoaded` (or a timeout) before calling `apply()` unless the experiment opts into early.
- Document the trade-off in authoring guide. Provide a "no-flicker pattern" snippet: hide the target element with CSS at document_start, then `apply()` at document_end, then unhide.
- For SPA navigation, use the URL-change hook from Pitfall 4.

**Warning signs:**
- Visible flicker/pop-in when experiment activates
- `apply()` errors with "queryselector returned null" on cold loads
- Inconsistent behavior between hard reload and SPA navigation

**Phase to address:** Engine — content script lifecycle phase.

**Severity:** **Important**

---

### Pitfall 12: Memory leaks from listeners, observers, and detached DOM not cleaned up on navigation

**What goes wrong:**
Each page session, the engine runs `apply()` for 5 experiments. Each experiment registers 2 event listeners and a MutationObserver, but no `cleanup()`. Designer navigates 50 pages without closing the tab → 250 observers and 500 listeners are alive, holding references to detached nodes. Tab memory grows from 80 MB to 1.5 GB over a workday. Browser eventually crashes.

**Why it happens:**
Cleanup is unrewarding work; bugs from leaked listeners are invisible until usage scales. SPA navigation doesn't fire `beforeunload` reliably. Many designer-authored experiments don't implement `cleanup()` at all.

**How to avoid:**
- The engine **owns all subscriptions on behalf of experiments**:
  - `ctx.on(target, event, handler)` → engine tracks every registration.
  - `ctx.observe(target, callback, options)` → engine tracks the observer.
  - `ctx.timeout(ms, fn)`, `ctx.interval(ms, fn)` → engine tracks timers.
- On `cleanup()` (or URL change taking the page out of scope), engine tears down everything that experiment registered. Designers don't write cleanup code; they use `ctx.*` and the engine handles it.
- Inject `data-exp-id` on every node. On cleanup, engine removes all nodes owned by the experiment.
- In dev mode, after cleanup, the engine asserts "no listeners/observers remain registered for this experiment." Logs leak in console.
- Use `WeakRef`/`WeakMap` internally where holding strong references to DOM nodes isn't necessary.

**Warning signs:**
- Tab memory grows monotonically over a session
- `chrome://discards` shows extension page accumulating MB
- Devtools "Performance" tab shows accumulating event listeners
- Browser slows down after several hours of use

**Phase to address:** Engine — lifecycle + ctx API phase.

**Severity:** **Important**

---

### Pitfall 13: `fetchPage()` returns the SPA shell, not the rendered content

**What goes wrong:**
Designer calls `fetchPage("https://example.com/product/123")` expecting to get the rendered product page. The site is a React SPA without SSR; the response is `<div id="root"></div>` and a `<script src="/bundle.js"></script>`. `DOMParser` returns a doc with no useful content. Experiment fails silently or surfaces empty data to the LLM.

**Why it happens:**
`fetchPage` does an HTTP fetch + DOMParser; it never executes JS. The decision was deliberate (no headless render in v1) but its limits are not visible to designers until they hit a SPA target.

**How to avoid:**
- Engine surfaces this clearly: `fetchPage` documentation includes "works on server-rendered content only; SPAs return empty shells." Include a list of known-rendered targets (Yandex SERPs, Wikipedia, news sites) and known-broken (modern React/Vue SPAs).
- The helper detects SPA shells heuristically: if the parsed doc has <500 chars of text content or only a single root div, return a structured warning to the caller (`{ok: false, reason: 'likely_spa_shell', html: '...'}`) so the experiment can handle gracefully.
- For Yandex specifically (the v1 reference target), document that SERPs are SSR'd → fetchPage works there. This is the validated use case.
- v2 path: optional headless-render proxy (Cloudflare Browser Rendering, Browserless.io) — out of scope for v1, but documented as the upgrade path.

**Warning signs:**
- `fetchPage` returns a doc with `body.textContent.length < 500`
- Designer reports "fetchPage worked on this URL but not that one"
- LLM responses are nonsense because the input is empty

**Phase to address:** fetchPage helper phase. Build the SPA-shell detector + clear error path before shipping.

**Severity:** **Important**

---

### Pitfall 14: `fetchPage()` blocked by CORS / Cloudflare / anti-bot

**What goes wrong:**
Designer fetches a site behind Cloudflare's "I'm not a bot" challenge. Service-worker `fetch()` returns the challenge HTML, not the page. Or the target enforces CORS and the SW request fails (though CORS doesn't apply to extension SW with proper host_permissions, so this is rarer than expected). Or the target requires login cookies that the extension SW request doesn't carry.

**Why it happens:**
Anti-bot is widespread. Extension SW fetches don't share user session cookies with the same target by default unless `credentials: 'include'` is set and host_permissions grant access — and even then, third-party cookies are blocked by default in modern Chrome.

**How to avoid:**
- For each target the team plans to fetch, validate manually first (curl-equivalent test in SW). Document which targets are reachable.
- Set `credentials: 'include'` in the SW fetch when the target requires login (e.g., Yandex internal pages). Declare `host_permissions` for the target — without it, cookies aren't sent.
- For Cloudflare-protected targets, accept that v1 cannot bypass them. Surface the failure clearly to the experiment: `{ok: false, reason: 'challenge_detected'}`.
- Privacy/ethics: document explicitly that `fetchPage` makes the extension fetch URLs the user did not visit. This is fine for closed team + URLs the team controls / has permission to fetch, but should not be used to scrape unrelated third parties at scale. Add a runtime warning if `fetchPage` is called with >10 distinct hostnames in a session.
- Respect `robots.txt` (engine could check at fetch time as a courtesy).

**Warning signs:**
- `fetchPage` returns HTML containing "Just a moment..." or "Checking your browser"
- HTTP 403 / 429
- Response body starts with `<html><head><title>Attention Required</title>` (Cloudflare)

**Phase to address:** fetchPage helper phase.

**Severity:** **Important**

---

### Pitfall 15: HMR for content scripts and service workers is fundamentally broken in MV3

**What goes wrong:**
Designer changes their experiment file. The Vite dev server pushes an HMR update to the popup → updates instantly. Tries to push to the service worker → SW reload kills all in-flight messages and the popup loses its connection. Tries to push to a content script → impossible: content scripts are injected on page load; you can't replace them without reloading the page.

Result: "hot-reload" only really works for popup UI. Content script and SW changes require an extension reload (`chrome.runtime.reload()`) **and** a target tab reload. This eats the workflow described in the project as "designer changes JS, plugin picks up without rebuild."

**Why it happens:**
MV3's CSP forbids the WebSocket → eval pattern that vanilla HMR uses. Even with CRXJS or Plasmo, content script HMR is approximated by listening for changes, calling `chrome.runtime.reload()`, and asking the user to reload the tab. SW HMR similarly resets state.

**How to avoid:**
- Use **CRXJS Vite plugin** (or Plasmo if preferred) — these handle MV3-compatible HMR as well as anyone has solved it. CRXJS has been the de-facto standard for MV3 + Vite as of late 2025.
- Manage expectations: document the dev workflow as:
  - Popup/options UI: true HMR (instant)
  - Service worker: SW restart (~1s, state reset)
  - Content scripts / experiments: extension reload + tab reload (~3s)
- Build a **dev-only experiment "live reload"** path that doesn't depend on Vite HMR:
  - Watch `experiments/**/*.js` for changes
  - On change, send a message to the active tab's content script
  - Content script unloads + re-imports the experiment dynamically (only works for experiments NOT bundled into the SW; in dev, load them via dynamic import from a `chrome-extension://` URL declared in `web_accessible_resources`)
  - In production, experiments ARE bundled; this is dev-only.
- Engine state should survive reloads: on `chrome.runtime.onStartup`, restore tweak values from storage so the designer doesn't lose context every reload.

**Warning signs:**
- Designer reports "I changed the file but nothing happened"
- Dev cycle exceeds 10s per change → designers will start patching DOM in devtools instead, defeating the purpose
- Vite dev server logs HMR success but extension shows old code

**Phase to address:** Dev tooling / build pipeline phase. Pick CRXJS or Plasmo on day one — switching costs are high.

**Severity:** **Important**

---

### Pitfall 16: shadcn/ui Radix dependencies misbehave in content-script context

**What goes wrong:**
shadcn/ui components (Dialog, Popover, Select, Tooltip) use Radix primitives, which use React Portals to mount overlays at `document.body`. In a content script with a Shadow DOM mount (recommended in Pitfall 5), the portal escapes the shadow root → the overlay renders unstyled (Tailwind CSS is shadow-scoped, so it doesn't reach the body) and may interact with the host page in unexpected ways.

**Why it happens:**
React Portals + Radix assume a normal document with body access. They don't know about shadow roots.

**How to avoid:**
- Configure Radix primitives to portal **into the shadow root**, not body. Most Radix components accept a `container` prop or a context provider (`Tooltip.Provider`, `Dialog.Portal container={...}`) that overrides the portal target.
- Render a portal-target div inside the shadow root and pass it to every Radix overlay component. Wrap shadcn/ui re-exports (`Dialog`, `Popover`, etc.) to inject this automatically.
- For the popup (which has its own document), no special handling needed — shadcn/ui works as designed.
- Test every overlay component in the in-page panel context before relying on it.

**Warning signs:**
- Tooltip / dropdown shows up in default browser style (no Tailwind)
- Overlay positioned at top-left of page instead of next to trigger
- Click-outside detection doesn't work
- Z-index fights with host page overlays

**Phase to address:** UI / content-script-UI phase.

**Severity:** **Important**

---

### Pitfall 17: Streaming LLM responses lost when service worker hibernates

**What goes wrong:**
Experiment calls `llm("write a long article")`, which streams back from the provider. Halfway through, the SW hibernates (Pitfall 1) — stream is aborted. The fetch promise rejects in the SW (which is gone), the content script's port disconnects, the partial response is lost, the user has paid for the tokens already consumed.

**Why it happens:**
SWs are terminated on idle. A long port keeps it alive — but only for ~5 minutes max. An LLM streaming response of a long output can exceed this.

**How to avoid:**
- For streaming, the SW pushes chunks to the content script via a long-lived `Port`. The port keeps the SW alive as long as there's activity (sending chunks counts as activity).
- Set a server-side max output cap (`max_tokens: 4096` for OpenAI, `max_tokens: 4000` for Anthropic). 4000 tokens streams in well under 30s with a fast model.
- For experiments that need long outputs, recommend non-streaming + show a "thinking" state in the UI rather than partial text.
- If the port closes unexpectedly mid-stream, the helper resolves with `{partial: true, text: '...so far'}` so the experiment can decide whether to retry.
- Don't hide the failure — surface "stream aborted" to the designer console.

**Warning signs:**
- LLM responses cut off mid-sentence
- Long outputs sometimes work, sometimes don't
- `chrome.runtime.lastError` from `port.disconnect`

**Phase to address:** LLM helper phase (after the basic non-streaming version works).

**Severity:** **Important**

---

### Pitfall 18: Multiple designers editing the engine code drift apart; experiments rely on per-user engine quirks

**What goes wrong:**
The architecture says "experiments are bundled with the engine into one extension build per user." Designer A patches a bug in the engine to make their experiment work. Designer B does the same locally with a different fix. Both push their experiments. Designer C builds the extension and gets a merge conflict in the engine. Or worse, no conflict, but Designer A's experiment now subtly breaks because it relied on A's engine behavior, not the merged main one.

**Why it happens:**
"Self-service folder per user" works for `experiments/<username>/` but not for shared engine code. If everyone's local build can include their own patches, the engine is no longer one thing — it's N things.

**How to avoid:**
- Strict ownership rule: **only the engine maintainer (Andrey, initially) edits engine code**. Designers open PRs / issues if they need engine changes.
- Engine code lives in a separate path (`engine/`, `packages/engine/`) with `CODEOWNERS` enforcing review.
- Every experiment imports the engine at a **stable versioned API surface** (`import { defineExperiment } from '@platform/engine'`). Engine changes are versioned; experiments declare which engine version they need; build-time check warns on mismatch.
- Build pipeline pulls engine from the shared location, never from a designer's local override (unless explicitly toggled in a dev mode).
- Experiments must not depend on engine internals. Linter forbids deep imports.

**Warning signs:**
- Engine file appears in many designers' commits
- "Works on my build" reports
- Merge conflicts in engine code on every PR

**Phase to address:** Repo / collaboration architecture phase. Set CODEOWNERS and the engine-API contract before onboarding the second designer.

**Severity:** **Important**

---

### Pitfall 19: Experiment discoverability collapses past ~30 experiments

**What goes wrong:**
v1 ships with the reference 3 designers × 1+ experiments. By month 6 there are 50 experiments across 8 designers. The popup UI is a flat list. Designers can't find anything. Two designers build similar experiments because they didn't know the other existed. Stale experiments accumulate (designer left team, experiment broken, no one removes it).

**Why it happens:**
The "self-service folder" pattern scales for authorship but not for discovery. No metadata = no search.

**How to avoid:**
- Manifest fields beyond name: `tags`, `targetSites`, `lastReviewed`, `status: active|deprecated|archived`, `description`.
- Popup UI v1 already supports grouping by author and basic search by name → that's enough for v1's 3-designer scope.
- Mark deprecated experiments visually in the UI (greyed out, "archived" badge).
- Auto-generated description (already in the requirements) helps — fill the metadata at build time.
- v2: a simple "experiment registry" page (a markdown page in repo, regenerated on push) that lists all experiments grouped by target site / tag. Not in v1 scope but plan for.

**Warning signs:**
- Popup scroll length > one screen
- Designers ask in chat "is there an experiment that does X?"
- Two PRs landing similar functionality in the same week

**Phase to address:** UI / discoverability phase (v1) and v2 planning.

**Severity:** **Important**

---

### Pitfall 20: `update_url` for sideloaded extensions doesn't auto-update without Web Store

**What goes wrong:**
Team distributes the extension as a `.crx` via GitHub Releases. The manifest declares `update_url: https://github.com/.../updates.xml`. Team expects users to auto-update. Reality:
- Chrome's auto-update **only honors `update_url` for extensions installed via the Web Store**, OR for "force-installed" extensions via enterprise policy.
- Manually-installed `.crx` files (drag-and-drop) and "load unpacked" extensions do **not auto-update**.
- Designers manually re-download/reinstall on every change.

**Why it happens:**
Documented but obscure. The `update_url` field exists; that doesn't mean it's honored everywhere.

**How to avoid:**
- Decision: accept manual update for v1. The closed-team scope makes this tolerable. Document the update process clearly.
- If auto-update is needed, options are:
  - Enterprise policy (`ExtensionInstallForcelist` via Chrome MDM) — overkill for a closed team but works.
  - Self-host at a domain the org owns + have each designer apply enterprise policy on their machine — fiddly.
  - Publish to Chrome Web Store as "unlisted" — only people with the link can install, but users get auto-update. Acceptable trade-off for many closed teams; out of scope for v1 per project requirements.
- Build a **version-check on extension startup**: SW fetches `https://github.com/.../latest-version.txt`, compares with `chrome.runtime.getManifest().version`, surfaces "update available" notification in the popup with a one-click "open release page" button. This is the v1 compromise: not auto-update, but "you'll know when to update."
- Keep the `.crx` install path; don't switch to a custom installer.

**Warning signs:**
- Designer reports "the experiment that should be there isn't" → they're on an old build
- Different designers have different visible features → version skew
- Bug fixed in main never reaches users

**Phase to address:** Distribution phase.

**Severity:** **Important**

---

### Pitfall 21: Yandex Browser policy differences vs upstream Chromium

**What goes wrong:**
Team tests on Chrome and Edge. Ships. A designer using Yandex Browser (one of the explicit target browsers) finds the extension can't be sideloaded — Yandex Browser has its own ext-policy enforcement, may reject `.crx` outside their store, may have different developer-mode UX, or may have a different MV3 implementation lag.

**Why it happens:**
Yandex Browser is Chromium-based but ships its own policies, occasionally a slightly different MV3 implementation timeline, and some user-facing changes to extension management UI. Chinese-market Chromium forks (360, etc.) are similar.

**How to avoid:**
- Validate extension install on every target browser early. Don't ship without an explicit smoke test on Yandex Browser specifically (since the project's reference scenario is `ya.ru`).
- Document the per-browser sideload procedure in onboarding (location of "developer mode" toggle, drag-and-drop target).
- For Yandex Browser specifically, "load unpacked" from a cloned repo is more reliable than .crx in some versions. Make this the documented path.
- Keep the manifest as conservative as possible — only use MV3 features that have been stable since Chrome 110+.

**Warning signs:**
- Designer can't install in their browser
- Extension installs but features don't work in one browser
- "Works in Chrome, not in Yandex"

**Phase to address:** Distribution phase.

**Severity:** **Important** (LOW confidence — Yandex Browser specifics may have shifted; verify in a real install during Phase 1)

---

## Moderate Pitfalls

### Pitfall 22: declarativeNetRequest vs webRequest for blocking — but probably neither needed for this project

**What goes wrong:**
A future feature wants to block / modify network requests on the host page (e.g., "skip this slow tracker so the experiment loads faster"). Team reaches for `webRequest.onBeforeRequest` blocking — which is partially deprecated in MV3. The right answer is `declarativeNetRequest`, which is declarative-only.

**Why it happens:**
MV3 deprecated blocking webRequest; the migration path (`declarativeNetRequest`) is poorly understood.

**How to avoid:**
- For v1, the project explicitly doesn't need network blocking — DOM mutation only. **Don't add this complexity until forced.**
- If/when needed: declarativeNetRequest with dynamic rules. Document as v2.

**Warning signs:**
- Someone asks "can we block X request?" → that's the moment to revisit.

**Phase to address:** Out of v1 scope.

**Severity:** **Moderate** (deferred)

---

### Pitfall 23: `host_permissions` over-grant raises trust concerns

**What goes wrong:**
Manifest declares `<all_urls>` for host_permissions to make `fetchPage` work on any URL. Designers' experiments have universal access to the page, including pages with sensitive content (banking, work tools). A bug in any experiment can leak data from any page.

**Why it happens:**
`<all_urls>` is the easy default. Scoping is fiddly.

**How to avoid:**
- Use `optional_host_permissions` and request access on a per-target-site basis the first time `fetchPage` is called for that host. Persist the grant.
- For content script injection: declare `host_permissions` only for the union of all experiment scope patterns. Regenerate this list at build time from experiment manifests.
- Document the access policy in onboarding: "the extension can see X, Y, Z domains because experiments target them."

**Warning signs:**
- Manifest contains `<all_urls>`
- Chrome shows a scary install prompt ("can read all data on all websites")

**Phase to address:** Manifest / build pipeline phase.

**Severity:** **Moderate**

---

### Pitfall 24: Tweak storage schema changes break old presets

**What goes wrong:**
Designer ships v1 of an experiment with tweaks `{tone: 'formal'|'casual'}`. Saves a preset to repo. v2 of experiment renames `tone` to `style`. Loading the v1 preset now fails — the experiment expects `style` and gets undefined.

**Why it happens:**
Tweak storage is freely-keyed JSON. No schema versioning.

**How to avoid:**
- Each experiment manifest declares a `version` field. Tweak presets serialize the experiment version they were saved against.
- On load, if the version differs, the engine runs migrations declared in the experiment (`migrate(oldTweaks, fromVersion, toVersion) → newTweaks`).
- In the simpler v1 form: missing fields fall back to defaults declared in the manifest, removed fields are silently dropped, type mismatches are logged. Migrations are an opt-in for designers who care.

**Warning signs:**
- Designer renames a tweak; presets sharing breaks
- "My saved preset no longer applies"

**Phase to address:** Tweak system phase.

**Severity:** **Moderate**

---

### Pitfall 25: Auto-generated `description.md` drift — code changes, description doesn't

**What goes wrong:**
Cursor generates a description on first build. Designer edits the code three weeks later but doesn't re-run the description generator. Description now lies about what the experiment does. Other designers reading the README pick a wrong experiment.

**Why it happens:**
Manual regeneration is forgettable.

**How to avoid:**
- Build pipeline auto-regenerates `description.md` from code on every build. Designer can override; if overridden, mark as "manual" and skip regen.
- Description includes a "last regenerated from commit `abc123`" footer; if the experiment.js has changed since, show a stale-warning in the popup.

**Warning signs:**
- Description references functionality that doesn't exist in code
- Description out of date by months

**Phase to address:** Build pipeline phase.

**Severity:** **Moderate**

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Run all experiments in one giant `try/catch` (no per-experiment isolation) | One line of code; ships v0.1 fast | Pitfall 8 — one bad experiment kills others. Must rebuild engine to add later. | **Never** — error isolation is foundational |
| `<all_urls>` host_permissions | Simplest manifest; `fetchPage` "just works" | Pitfall 23 — install prompt scary; security audit fails; broad blast radius for bugs | OK for very early dev only; scope before any external user installs |
| Skip Shadow DOM; inject CSS into host page | Less plumbing; shadcn/ui works without portal config | Pitfall 5 — host page styles break; never recoverable without rewrite of all in-page UI | Only if no in-page panel is ever needed (popup-only UI) |
| Store API key in plain `chrome.storage.local` (no warning surfaced to user) | Simple; fine for closed team | Pitfall 6 — leak vector; user's monthly bill at risk | Acceptable for v1 with explicit threat model documentation + per-user spend cap on provider side |
| No spend cap / no caching in `llm()` helper | Ships v1 sooner | Pitfall 7 — first $500 surprise bill kills team trust in the tool | **Never** — at least a session counter ships v1 |
| No `cleanup()` lifecycle; leak listeners | One less concept for designers to learn | Pitfall 12 — multi-hour sessions become unusable | Only if engine owns subscriptions via `ctx.*` (i.e., the cost is hidden, not avoided) |
| Pure JS experiments (no TypeScript) | Lower barrier for designers without TS background | Pitfall 8 — runtime errors that types would catch | OK for v1 if engine wraps experiments in error boundary; nudge to TS in v2 |
| No CRXJS/Plasmo, hand-rolled build | No third-party dep; full control | Pitfall 15 — HMR + manifest gen pain blocks daily workflow | **Never** for this team size — toolchain is standard, build it |
| No per-author folder versioning | Onboarding is "make a folder, go" | Pitfall 24 — tweak schema changes silently break others' presets | OK at v1 (3 designers); revisit at >5 |
| Bundle the engine into every experiment build (no shared engine) | "Self-contained experiments" sound clean | Pitfall 18 — engine drift; n versions of engine in production simultaneously | **Never** — engine must be shared, versioned |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI / Anthropic API from SW | Sending requests with API key in URL params | `Authorization` header only; never log; per-session counter |
| `chrome.storage.local` from MAIN world | Calling directly — throws | Route through isolated content script via `postMessage`; isolated does the storage call |
| `chrome.scripting.executeScript({world: 'MAIN'})` | Trying to pass non-serializable objects in `args` | `args` is structured-cloned; serialize first; for functions/closures, embed in `func` |
| MutationObserver on `document.body` with `subtree: true` | Fires on every child mutation including own writes | Wrap mutating writes in `applyMutation` flag; filter own `data-exp-id` |
| Shadow DOM + Tailwind | Tailwind preflight scopes globally; CSS leaks both ways | `corePlugins.preflight = false` for in-page bundle; manually scope reset to `:host`; or keep preflight inside shadow root |
| Radix UI inside shadow root | Portals escape to body | Provide portal `container` prop pointing into shadow root |
| Service worker `fetch()` | Assuming session cookies are sent | Use `credentials: 'include'` + declare `host_permissions` for the target host |
| `fetchPage` on SPA | Returning empty shell silently | Detect short body / single-div doc → return structured warning, not silent empty result |
| Long-lived port for SW keep-alive | Port idle for >5 min → forcibly closed | Document the 5-min cap; for longer work, chunk into multiple ports |
| `chrome.runtime.reload()` for dev hot-reload | Reloads close popups/devtools mid-debug | Trigger reload only on file save events with a 500ms debounce; show toast in popup before reload |
| `web_accessible_resources` for in-page injected scripts | Forgetting to declare → script blocked | List every dev-mode dynamic-import URL |
| `update_url` in manifest | Expecting auto-update on sideload | It doesn't work without Web Store / enterprise policy; build manual update notification instead |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| MutationObserver scoped to `document.body` with `subtree: true` | Tab CPU at 30%+ idle | Scope to specific subtree; debounce callback 50–100 ms | Pages with frequent ad/widget mutations (most modern sites) |
| Recursive observer fire (apply triggers mutation triggers apply) | CPU 100%, page unresponsive | `applyMutation` wrapper sets ignore flag | Any time experiment writes inside observer callback (extremely common) |
| Synchronous heavy work in `apply()` | Page jank on load, "page unresponsive" prompt | Engine warns at >50ms sync; designer chunks via `requestIdleCallback` | Experiments doing >100 DOM operations or heavy text parsing |
| `llm()` called inside MutationObserver callback | Cost spike; rate limit | Engine refuses or warns; require explicit debounce wrapper | Any experiment that "enriches each new result" naively |
| Memory leak from unowned listeners | Tab memory grows over hours | `ctx.on/observe/timeout/interval` instead of raw APIs | Any session > 1 hour without page reload |
| Service worker churn (rapid wake-sleep cycles) | High background CPU; battery drain | Batch event handling; avoid `chrome.alarms` < 30s in production | When extension is always-on with lots of small events |
| Many experiments active on same page, each scanning DOM independently | Linear-N slowdown on page load | Engine offers shared scan API; experiments declare interest in nodes; one pass dispatches | >5 active experiments on heavy page |
| Loading shadcn/ui as a single bundle in popup | Popup feels slow to open (>200ms) | Code-split; lazy-load tweak editor components | Popup with many experiments listed |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API key logged or exposed in error messages | Public leak; cost theft | Wrap helper in key-redacting logger; never include key in errors surfaced to experiment |
| Experiment can read other experiments' tweaks via shared `chrome.storage` | One bad experiment exfiltrates settings of others | Namespace storage by experiment ID; engine mediates access |
| `eval`/`new Function` accidentally introduced via dependency | CSP violation kills extension; or worse, allows injection | Lint-time forbid; build-time scan of bundled JS for `eval(`/`Function(` |
| `fetchPage` used to fetch authenticated URLs leaking session data into LLM prompts | User's private data sent to OpenAI | Engine allowlist of fetchable hosts per experiment; warn on credential-bearing requests |
| Experiment injects HTML from LLM response without sanitization | Stored XSS via LLM (model-injected scripts) | Engine provides `ctx.renderHTML(html)` that runs DOMPurify; raw `innerHTML` of LLM output is forbidden by lint |
| MAIN-world experiment hijacks page's auth tokens | Experiment with broad scope reads `localStorage` of bank tab | Scope patterns must be explicit per experiment; reviewer checks scope on PR; no `<all_urls>` experiments |
| Engine `eval`s tweak values at any layer | Tweak text-input becomes JS-injection vector | Tweak values are always strings/numbers/bools/arrays; no `eval` anywhere; HTML rendering goes through sanitizer |
| Repo includes a `.env` with real keys committed by mistake | Public leak if repo ever forks | `.gitignore` `.env`; pre-commit hook scans for `sk-`/`xai-`/`anthropic-` patterns |
| `web_accessible_resources` exposes every bundled file | Unrelated sites can detect/exploit extension | List only the specific files needed |
| Enabling `'unsafe-eval'` in manifest CSP "to make a library work" | All MV3 security guarantees broken | Replace the library; `'unsafe-eval'` is never the right answer |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Experiment activates with visible flicker (apply at document_idle) | Designer sees "broken page" momentarily; bad demo | Hide-then-replace pattern: hide target at document_start, apply at idle, unhide |
| Tweak change requires page reload to take effect | Designer can't iterate fast | Engine auto-reapplies on tweak change; experiments that genuinely need reload declare `requiresReload: true` |
| Popup shows experiments running but provides no error feedback | Silent failure → designer thinks it's a code bug, spends hours debugging engine, was actually a selector miss | Per-experiment status: green (applied N nodes), yellow (no matches), red (error) — with details |
| No way to see what an experiment actually changed on the page | Designer confused why page looks weird | "Inspect changes" button in popup highlights all `data-exp-id="..."` nodes |
| LLM call costs hidden | Surprise bill | Live token counter in popup; per-call cost in dev console |
| Forking another's experiment requires git surgery | High friction → people don't fork → duplication | One-click fork in popup: clones folder to user's directory, opens editor |
| Tweaks reset on extension reload (dev workflow) | Designer redoes setup every code change | Persist tweaks across reloads; differentiate "dev reload" from "user reset" |
| No indication that an experiment scope doesn't match current page | Designer enables experiment, navigates, "nothing happens" — turns out URL doesn't match | Popup grays out experiments not matching current URL; tooltip shows scope pattern |
| Description.md not surfaced in popup | Designer has to open repo to remember what experiment does | Popup shows description on hover/expand |
| No undo when experiment breaks the page | Designer has to disable + reload to recover | One-click "disable all on this page" panic button |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Service worker MVP**: Often missing → top-level listener registration. Verify by: idle the SW for 60 seconds (or trigger via `chrome://serviceworker-internals` "stop"), then send a message — does it wake and respond?
- [ ] **Content script injection**: Often missing → SPA navigation handling. Verify by: load page, navigate via internal link (no full reload), check that experiment re-applies.
- [ ] **MutationObserver loop guard**: Often missing → self-mutation filter. Verify by: stress test with experiment that modifies a node 1000× — CPU should not exceed 5% sustained.
- [ ] **Shadow DOM in-page panel**: Often missing → portal target for Radix overlays. Verify by: open a Tooltip / Dialog / Popover inside the panel — must be styled correctly.
- [ ] **Tailwind preflight**: Often missing → either disabled for in-page bundle, or scoped via shadow root. Verify by: load extension on Yandex SERP and check that page headings have unchanged size/weight.
- [ ] **LLM helper**: Often missing → prompt-cache; spend counter; max-retries; max output tokens. Verify by: call same prompt twice — second is instant; trigger 100 calls in a loop — circuit breaker fires.
- [ ] **fetchPage helper**: Often missing → SPA-shell detection; CORS / Cloudflare error surfacing. Verify by: fetch a known SPA → returns structured warning, not silent empty.
- [ ] **API key handling**: Often missing → never logs the key; per-session spend cap; never includes in URL. Verify by: search source bundle for the key string after a session — should not appear in any log line.
- [ ] **Per-experiment error isolation**: Often missing → each `apply()` wrapped in try/catch; one error doesn't break others. Verify by: insert deliberate `throw` in one experiment, confirm others run.
- [ ] **Cleanup on navigation**: Often missing → all listeners/observers/timers removed. Verify by: enable experiment, navigate away, check `getEventListeners(document)` and observer count — should drop to baseline.
- [ ] **Tweak schema versioning**: Often missing → preset declares experiment version. Verify by: rename a tweak field, load old preset, confirm graceful handling (default fallback, log warning).
- [ ] **CSP compliance**: Often missing → no `eval`/`new Function`/remote import in any bundled code. Verify by: build bundle, grep for `eval(`/`new Function(`/`import\(.*https`.
- [ ] **Hot reload**: Often missing → designer's mental model matches reality (popup HMR, content scripts need tab reload). Verify by: change content script file, observe what reloads; document the actual flow.
- [ ] **Update notification**: Often missing → manual sideload doesn't auto-update; surface "update available" banner. Verify by: bump version on remote, run extension, see notification within 5 min.
- [ ] **CODEOWNERS / engine ownership**: Often missing → designers can't accidentally change engine. Verify by: open PR touching `engine/` as a designer, GitHub requires Andrey's review.
- [ ] **Yandex Browser smoke test**: Often missing → tested only on Chrome. Verify by: install on Yandex Browser, run the v1 reference scenario, check all features work.
- [ ] **Sideload installation docs**: Often missing → onboarding has step-by-step with screenshots for each browser. Verify by: hand the docs to a non-Andrey teammate, time how long to first-experiment-running.
- [ ] **In-page panel position/z-index**: Often missing → tested only on simple pages. Verify by: load on heaviest target (Yandex SERP with ads), confirm panel renders above page UI without visual conflict.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SW state loss in production (Pitfall 1) | LOW | Move state to `chrome.storage.local`; rerun affected actions on next event; no data loss possible if storage was authoritative |
| CSP-violation library blocking load (Pitfall 2) | MEDIUM | Identify violating library; replace with CSP-safe alternative or inline-required functionality; rebuild |
| Wrong-world execution (Pitfall 3) | HIGH | Refactor experiment / engine API to declare world per experiment; bridge via postMessage; test both worlds |
| SPA wipes experiment (Pitfall 4) | MEDIUM | Add MutationObserver + URL-change handler to engine; re-apply on relevant changes; mark nodes with stable IDs |
| Tailwind preflight broke host page (Pitfall 5) | HIGH | Move all in-page UI inside Shadow DOM; rewrite renderer entry point; disable preflight for in-page bundle |
| API key leaked (Pitfall 6) | HIGH | Rotate key on provider; revoke leaked key; audit logs for unauthorized usage; add lint to prevent recurrence; cap spend |
| Cost runaway (Pitfall 7) | MEDIUM (financial) | Disable problematic experiment; enable cap on provider key; ship cache + counter; review experiment for the loop |
| Experiment crash chain (Pitfall 8) | LOW | Wrap engine's experiment loop in try/catch; redeploy; auto-recovery for next session |
| Observer infinite loop (Pitfall 9) | LOW (per occurrence; HIGH if shipped) | Disable problematic experiment from popup; ship `applyMutation` wrapper; mutation-rate circuit breaker |
| Hashed-class selector breakage (Pitfall 10) | MEDIUM | Replace selector with stable attribute; update authoring guide; lint hashed-class patterns |
| Memory leak after long sessions (Pitfall 12) | MEDIUM | Migrate experiment registrations to `ctx.*` API; engine teardown on cleanup; users restart browser as workaround |
| `fetchPage` returns SPA shell (Pitfall 13) | LOW | Surface clear "SPA shell detected" error to experiment; document workaround (server-render-only targets); v2: optional headless |
| HMR broken expectations (Pitfall 15) | LOW | Document actual workflow; build dev-only "experiment live reload" that doesn't depend on Vite HMR |
| Engine drift (Pitfall 18) | HIGH | Establish CODEOWNERS + engine versioning retroactively; force engine merge; designers update their experiments to declared API |
| User on stale build (Pitfall 20) | LOW | Manual install of latest .crx; ship version-check + notification banner |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phase names are illustrative — the roadmap should pick its own.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. SW lifecycle assumptions | Engine Foundation / SW Architecture | Idle test: stop SW, send event, verify wake + state restore |
| 2. CSP violations | Engine Foundation + CI Lint | Build pipeline scans for `eval`/remote imports; fails build |
| 3. Wrong execution world | Engine Foundation / Content Script Architecture | Test runs `apply()` from both worlds; correct world for each helper |
| 4. SPA re-render wipes | Engine — DOM Lifecycle | Test on Yandex SERP: paginate, navigate, scope-out — experiment behaves correctly |
| 5. Tailwind preflight host damage | UI / Content Script UI Phase | Snapshot test of host page DOM/CSS before/after extension load — must be unchanged outside experiment-owned nodes |
| 6. API key exposure | LLM Helper / Security Phase | Bundle grep test for key string in logs; threat-model doc reviewed |
| 7. Cost runaway | LLM Helper Phase | Stress test 100 calls in loop → circuit breaker; counter visible; cache hits |
| 8. Per-experiment error chain | Engine Foundation / Error Isolation | Inject deliberate throw in one experiment → others still run |
| 9. Observer loops | Engine — DOM Lifecycle | CPU stress test; circuit breaker trips on >100 mutations/s |
| 10. Hashed class selectors | SDK / Authoring Tooling Phase | Lint flags hashed-class selectors at commit time |
| 11. First-paint timing | Engine — Lifecycle | Visual flicker test on cold load |
| 12. Memory leaks | Engine — `ctx.*` API Phase | Hour-long browsing session memory profile |
| 13. `fetchPage` SPA shell | fetchPage Helper Phase | Test on known SPA → returns structured warning |
| 14. `fetchPage` blocked / anti-bot | fetchPage Helper Phase | Test on Cloudflare-protected URL → clear error |
| 15. HMR misunderstanding | Build Pipeline / Dev Tooling Phase | Documented dev workflow matches reality; CRXJS or Plasmo selected |
| 16. Radix in shadow root | UI / Content Script UI Phase | All shadcn overlays render correctly inside in-page panel |
| 17. Streaming truncation | LLM Helper Phase (post-streaming) | Long-stream test: completes or surfaces partial cleanly |
| 18. Engine drift | Repo Architecture / CODEOWNERS Phase | PR touching engine requires Andrey review; engine version pinned in experiments |
| 19. Discoverability collapse | UI / Discoverability (v1 baseline; v2 expansion) | Search by author/tag in popup |
| 20. No auto-update | Distribution Phase | Version-check banner ships with extension |
| 21. Yandex Browser specifics | Distribution Phase | Smoke test on Yandex Browser part of release checklist |
| 22. webRequest deprecation | Out of v1 scope | N/A — defer until needed |
| 23. host_permissions over-grant | Manifest / Build Pipeline Phase | Manifest review on PR; no `<all_urls>` |
| 24. Tweak schema versioning | Tweak System Phase | Old preset loads with default fallback + warning log |
| 25. Description drift | Build Pipeline Phase | Description regen on every build; staleness banner if manual edit lags code |

---

## Sources

External web access (WebSearch, WebFetch, gsd-sdk Brave search) was denied during this research session. The pitfalls are drawn from Claude's training data through January 2026, which covers:

- **Chrome Extensions documentation** — `developer.chrome.com/docs/extensions` MV3 reference (lifecycle, scripting API, CSP, `world: MAIN`, `host_permissions`, `declarativeNetRequest`, `update_url`)
- **CRXJS Vite plugin** — primary MV3 + Vite tooling as of late 2025; documents HMR limitations explicitly
- **Plasmo framework** — alternative MV3 toolchain with similar HMR caveats
- **Tailwind CSS** documentation — preflight reset, `corePlugins` config
- **shadcn/ui** + Radix UI — Portal `container` prop, theming via CSS variables
- **MV3 migration write-ups** — Chrome team blog posts and community migration retrospectives (Adblock, uBlock Origin Lite, multiple commercial extensions)
- **MDN web docs** — MutationObserver, Shadow DOM, ContentSecurityPolicy
- **OpenAI / Anthropic API documentation** — streaming, rate limits, key best practices
- **Personal/applied experience** with extension authoring — patterns codified in dozens of MV3 codebases

**Items where verification is recommended before acting (LOW confidence due to potential drift):**
- Pitfall 21 (Yandex Browser specifics) — verify in real install during Phase 1
- Pitfall 1 (exact SW idle timer values, port-keepalive 5-min cap) — confirm against current Chrome version at implementation time
- Pitfall 20 (`update_url` behavior on sideloaded `.crx`) — Chrome enterprise policy semantics shift; re-verify
- Pitfall 15 (CRXJS vs Plasmo state of HMR) — verify current versions' behavior in Phase 1 spike

For Phase 1 / engine-foundation work, schedule a 1-day spike that validates Pitfalls 1, 3, 4, 9, 15 with real code on real Yandex pages — these are the highest-cost-to-recover-from items if the architecture is wrong.

---
*Pitfalls research for: Chromium MV3 designer-experiment platform*
*Researched: 2026-04-25*
