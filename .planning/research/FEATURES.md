# Feature Research

**Domain:** Designer-experiment browser extension platform (DOM-mutating experiments + declarative tweaks + git-based sharing inside a closed team)
**Researched:** 2026-04-25
**Confidence:** MEDIUM (synthesis from training-data knowledge of Tampermonkey, Stylus, VisBug, Optimizely Web, VWO, Mutiny, Plasmo, Polypane, Figma/CodeSandbox sharing UX. External research tools — WebSearch / WebFetch / SDK CLI — were unavailable in this environment, so claims are not freshly verified against current docs. Patterns in this space are stable, so MEDIUM is honest. HIGH-confidence items are anchored in published primary sources I'm certain of; LOW-confidence items are flagged inline.)

> **Research-tool note:** WebSearch, WebFetch, and `gsd-sdk query websearch` were all denied in this environment. I proceeded from training data covering each named product through ~2025. Where I'm unsure of a detail (e.g. exact Stylus matching syntax versions, exact UI of Optimizely Web's most recent editor), I flag it. This dimension benefits from a follow-up live-verification pass before requirements freeze, but the structural conclusions (table-stakes / differentiators / anti-features) are robust to the specific details we couldn't re-verify.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These features are universal across the surveyed product categories. Designers/PMs in the target audience have used Tampermonkey, Stylus, browser DevTools, and visual A/B tools — they will perceive their absence as "this is broken" rather than "this is minimal."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **List view of all available experiments** | Universal in Tampermonkey dashboard, Stylus manager, Optimizely campaign list, VWO experiments tab. First thing every user opens. | LOW | Group by author (matches repo layout `experiments/<username>/`). Show name + 1-line description + author. |
| **Per-experiment enable/disable toggle** | Tampermonkey checkbox per script; Stylus toggle; Optimizely "draft / live"; every userscript manager since Greasemonkey 2005. | LOW | Toggle persists per-user in `chrome.storage.local`. Already in PROJECT.md Active. |
| **Visible indicator that experiments are active on current page** | Tampermonkey badge counter on toolbar icon; Stylus shows "N styles active"; uBlock shows count. Without it, users can't tell if anything is running, and "did my tweak apply?" becomes a debugging session. | LOW | Action badge counter (chrome.action.setBadgeText) showing # of enabled experiments matching current URL. |
| **Popup UI scoped to current tab** | Tampermonkey popup lists scripts matching current URL with toggles; Stylus popup shows applicable styles; this is the dominant UX pattern. Designer wants 1-click "turn this off / tweak it" without leaving the page. | LOW | Popup filters experiments to those whose `scope` matches `tabs.query({active:true}).url`. |
| **URL-scope matching (glob/regex)** | Already in PROJECT.md. Standard since Greasemonkey `@match`/`@include`. Without it, experiments fire on irrelevant pages. | LOW-MED | Already required. Use Chrome's match-pattern format (familiar) plus optional regex fallback (Stylus-style). |
| **Auto-rendered settings UI from manifest** | Plasmo Storage Hooks, options-page generators, even Logitech/SteelSeries device drivers do this. Users don't expect to write a settings UI for every tweak. | MED | Already in PROJECT.md (toggle/select/text/slider/color/multi via shadcn/ui). |
| **Settings persistence across browser restart** | Implicit expectation. `chrome.storage.local` already chosen. | LOW | Already required. |
| **Re-apply experiment when settings change without page reload** | Stylus does this for CSS; Optimizely's editor does live preview. If user toggles a tweak and has to reload, they lose flow. | MED | Re-run `apply()` on tweak change; experiments must be idempotent or expose `revert()`. **Implies experiment lifecycle contract (apply/revert)** — see Differentiators. |
| **Experiment metadata: name, description, author, version** | Every userscript has `@name @author @version @description`. Every Optimizely campaign has name/owner. Without metadata, the list view is unreadable. | LOW | Sourced from `manifest.json` + `description.md`. Already covered. |
| **Search / filter the experiment list** | Tampermonkey has search; Stylus has search; Chrome extension page has search. With 3 designers × N experiments × time, the list grows fast. Search-by-name minimum. | LOW | Client-side filter on name + description + author. |
| **Error visibility when an experiment crashes** | Tampermonkey shows script errors in dashboard; DevTools console is the universal escape hatch. Silent failure is the #1 complaint about tweak/extension tools. | MED | Wrap `apply()` in try/catch, surface error in popup next to the experiment, log to `console` namespaced (`[exp:<id>]`). |
| **Open experiment source from popup** | Tampermonkey "Edit script" button; Stylus "Edit" button; one click → editor. For our case, this means "reveal in Finder / open in Cursor" — link to the file path in the cloned repo. | LOW | `chrome.tabs.create({url: 'vscode://file/...'})` or `cursor://file/...` URL handler. |
| **Reset tweak values to defaults** | Standard "restore defaults" button across every settings UI. | LOW | Per-experiment "reset" button in tweak panel. |
| **Show LLM call counter / cost indicator in current session** | Already in PROJECT.md Constraints ("плагин обязан показывать счётчик вызовов"). Users with self-funded API keys will demand this. | LOW-MED | Badge or popup line: "12 LLM calls this session." |

### Differentiators (Competitive Advantage)

Features that distinguish this product from the closest analogs (Tampermonkey, Stylus, Optimizely Web, VisBug). These are where the designer-team-with-git positioning earns its keep.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Auto-generated `description.md` from Cursor/Claude at build time** | Tampermonkey/Stylus rely on hand-written headers — they go stale. Optimizely makes you fill a description form. Our pipeline reads the code and generates the description, so the list view is always accurate without designer toil. | MED | Already in PROJECT.md. Cursor/Claude as part of build pipeline reads `experiment.js` and writes `description.md`. Designer can hand-edit. |
| **One-click "Fork to my folder" from the popup** | GitHub fork UX brought into the extension popup. Tampermonkey has "duplicate script" but it's just a copy in your local list. Ours copies the experiment into `experiments/<my-username>/<id>-fork/`, opens in Cursor. Lowers the barrier from "I want to tweak Andrey's experiment" to "I have my own copy in 5 seconds." | MED | Already in PROJECT.md. Implementation: file-system access via native messaging or `chrome.fileSystem` is restricted; likely "copy manifest+source to clipboard + show shell command." Or a tiny CLI helper invoked via `cursor://` deep link. **Worth a feasibility note** — see Pitfalls. |
| **`llm()` and `fetchPage()` helpers built into experiment runtime** | Tampermonkey gives you `GM_xmlhttpRequest` but no LLM, no DOM-fetch. Optimizely doesn't run server requests at all. This unlocks "AI-generated content variants" as a first-class experiment shape. | MED | Already in PROJECT.md. Service-worker-mediated; per-user API key. |
| **Tweak presets shareable through the repo** | Stylus and Tampermonkey have settings, but settings are local-only. Optimizely has variant-level config but it's tied to a campaign in their cloud. Our presets ship through git: "I made this experiment, here's how I had it tuned" — designers see and can load the author's recommended state. | MED | Already in PROJECT.md ("Возможность сохранить выбранные значения твиков как пресет в репо"). UI: dropdown of presets at top of tweak panel. |
| **Hot-reload dev mode** | Already in PROJECT.md. Tampermonkey requires save+reload; Stylus is faster but still requires popup reopen. A file-watcher → live re-apply loop is a meaningful designer-velocity win. | MED-HIGH | Already required. Likely implementation: dev-mode watcher in extension polling local repo or a tiny WS sidecar. |
| **Author attribution surfaced in UI (group by author)** | Userscripts are typically a flat list with no team feel. Our repo structure `experiments/<username>/...` already encodes authorship; the popup should reflect it: collapsed sections "From Andrey," "From Maria." Reinforces team identity, makes "whose tweak is this acting weird?" answerable. | LOW | Trivial given repo convention. |
| **In-popup tweak preview snapshot** | Optionally show a small thumbnail / annotated screenshot of "what this experiment changes" in the popup. Solves the "I don't know what 'Видеообзор-блок' actually does" problem. Optimizely does this in its campaign list. | HIGH | Captured at build time (designer pastes a screenshot to `screenshot.png`) OR auto-captured first time it runs (`chrome.tabs.captureVisibleTab` after `apply()`). Defer if costly. |
| **Apply order is visible and reorderable** | PROJECT.md says "applies in order of enabling" — but this only works if the user can SEE and CHANGE the order. Otherwise debugging conflicts is dark magic. Drag-to-reorder list. | MED | Solves a real pitfall (multiple experiments touching same DOM). See ARCHITECTURE notes on conflict-resolution. |
| **Per-experiment changelog from git history** | Free byproduct of git: "this experiment changed yesterday by Andrey" → click → see diff. Optimizely has revision history but it's siloed. Ours leverages git commits directly. | LOW-MED | Read git log for the experiment's directory at build time, embed in `description.md` or a separate `history.json`. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that adjacent products have and users may ask for, but that would harm this product given its closed-team / git-native / MV3 constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Visual / WYSIWYG editor for experiments** (Optimizely-style point-and-click) | "Designers shouldn't write code" is a tempting framing. Optimizely Web, VWO, Mutiny all sell this. | The whole point of this product is that designers DO write code (in Cursor with AI). A visual editor is a different product (~6 month build), competes with the AI-assisted-code workflow, and the recorded changes are typically fragile selectors that break on the next site deploy. PROJECT.md "Auto-извлечение структуры чужих блоков" is already Out of Scope — same reason. | Lean harder into Cursor-as-editor: Cursor/Claude DOES author the experiment code. We provide great runtime + great manifest tooling. |
| **Conditional tweaks (show tweak X only if Y is set)** | Powerful settings UIs have this. PROJECT.md flags it Out of Scope already. | Adds expression-language complexity, validation rules, UI re-layout logic. v1 user count is 3 designers — they can structure their experiments to not need it. | All tweaks always visible. If a tweak doesn't apply, the experiment ignores it. |
| **Cross-device tweak sync** (chrome.storage.sync or backend) | Modern extensions sync settings; users expect it. PROJECT.md flags it Out of Scope. | Requires either Google sync quota (50KB/key, 8KB/item caps that bite quickly with rich tweak state), or a backend (which we don't have). Designers work primarily from one machine. | `chrome.storage.local` per-device. Presets in repo cover the "share my setup" case. |
| **Conflict resolver / merge UI for overlapping experiments** | Two experiments hitting `.search-results` will fight. A 3-way merge UI sounds smart. PROJECT.md flags it Out of Scope. | Designers can't reason about a generic conflict-resolver. The well-defined UX is "you saw the order, you reordered, you saw the result." | Visible apply order (in Differentiators) + designer responsibility. |
| **Public experiment marketplace / sharing site** | Userstyles.world, Greasy Fork. Tempting "we should have a directory." | Not the product. Closed team is the entire premise. Public marketplace = needs review, moderation, abuse handling, security model. | The git repo IS the directory. PRs are the publishing flow. |
| **Per-experiment LLM budget enforcement / hard rate-limit** | Cost paranoia. PROJECT.md flags it Out of Scope for v1. | Real budget enforcement requires backend + auth + reliable usage attribution. v1 is 3 trusted users with their own keys. | Visible session counter (Table Stake). v2 if a user actually overspends. |
| **Headless rendering for SPA `fetchPage()`** | "Why doesn't fetchPage work on React sites?" PROJECT.md flags Out of Scope. | Adds Puppeteer/Playwright runtime, multi-MB binary, can't be inside MV3 service worker, requires desktop sidecar. Massively expands surface. | Document the SSR-only constraint clearly. Suggest: scope experiments to server-rendered pages (ya.ru does this). |
| **Real-time multi-user collaborative editing** (Figma-style cursors on the experiment) | Designers expect Figma-grade collaboration these days. | Requires CRDTs, presence server, websocket infra. Our editor is Cursor — a desktop IDE — which already has its own collab model (Live Share). | Use git. Use Cursor's collab. Don't rebuild Figma. |
| **Auto-publish on git push (CI builds and pushes a `.crx` everyone auto-installs)** | "Magic distribution." Userscript managers have remote @updateURL. | MV3 explicitly forbids remote-loaded JS. PROJECT.md "bundle + rebuild + redistribute" is already the chosen architecture. Auto-update of side-loaded `.crx` is fragile and Chromium has been tightening side-load policies. | GitHub Releases + manual install + clear changelog in releases. v1.5: auto-update via GitHub Actions building `.crx` per release. |
| **In-extension code editor** (Tampermonkey-style) | Tampermonkey lets you edit scripts in the extension popup/dashboard. Comforting for casual users. | Our authoring tool is Cursor (a designed-for-this IDE with AI). Building a Monaco/CodeMirror in-extension editor is wasted effort that competes with Cursor's UX, with worse AI integration. | "Open in Cursor" deep link. Done. |
| **Built-in selector picker / element inspector** (à la VisBug, ColorZilla) | Useful for inspecting target site DOM. | DevTools already exists. VisBug exists. Building a competitor is multi-week, distracts from the value prop, and most of our experiments are written with Cursor + Claude pasting in the structure. | Recommend installing VisBug alongside. Maybe add a one-click "open DevTools elements panel" link. |
| **Experiment screenshots auto-captured at every commit** | Sounds great for the list view. | Requires CI with browser, target-site auth modeling, deterministic state. Big infra build. | Optional `screenshot.png` checked in by designer; auto-snap once on first run as enhancement. |

---

## Feature Dependencies

```
Auto-rendered tweak UI (manifest → controls)
    └──requires──> Manifest schema (toggle/select/text/slider/color/multi)
                       └──requires──> Manifest validation at build time

Per-experiment enable/disable toggle
    └──requires──> Per-user state in chrome.storage.local
                       └──requires──> Experiment ID stable across rebuilds

Apply experiment on page
    └──requires──> URL-scope matching engine (glob/regex)
    └──requires──> Experiment lifecycle contract (apply / revert)
                       └──requires──> Re-apply on tweak change (Table Stake)

Popup scoped to current tab
    └──requires──> URL-scope matching engine (shared with apply pipeline)
    └──requires──> Active-tab URL access (tabs permission)

Visible apply order + reorder
    └──requires──> Per-user enable order persisted
    └──enhances──> Multiple experiments on one page

Hot-reload dev mode
    └──requires──> Local dev build with file watcher
    └──conflicts──> Bundled .crx prod build (different load path)

Tweak presets shareable in repo
    └──requires──> Manifest schema (presets reference tweak IDs)
    └──requires──> Tweak values persistence (Table Stake)

Fork to my folder
    └──requires──> Repo path known to extension (config or file picker)
    └──requires──> Author/folder convention (experiments/<username>/)
    └──enhances──> Author attribution in UI

llm() helper
    └──requires──> Per-user API key in extension settings
    └──requires──> Service-worker proxy (CORS / key isolation)
    └──requires──> LLM call counter (Table Stake — billing visibility)

fetchPage() helper
    └──requires──> Service-worker fetch + DOMParser
    └──conflicts──> Headless rendering (deliberately not built — Anti-Feature)

Auto-generated description.md
    └──requires──> Build pipeline that invokes Cursor/Claude
    └──enhances──> List view readability + Search

Open in Cursor deep link
    └──requires──> File path of experiment in cloned repo (config)
    └──requires──> cursor:// URL handler installed (assume yes for target users)

Per-experiment git changelog
    └──requires──> Build-time git log read
    └──enhances──> Description / list view
```

### Dependency Notes

- **Apply pipeline requires a lifecycle contract.** "Re-apply on tweak change" (Table Stake) implies experiments must be idempotent OR expose a `revert()` to undo before re-applying. This needs to land in the experiment author API early — retrofitting is painful. Recommend: require `apply({tweaks, ...})` to return a `revert()` closure (React-`useEffect` style). MEDIUM confidence this is the cleanest API.
- **URL-scope matching is shared infrastructure.** Both "apply on page" and "popup scoped to current tab" depend on it. Build it once, cleanly, before either feature lands.
- **Stable experiment IDs are foundational.** Settings, enable state, presets, and forks all key off experiment ID. If IDs are derived from folder paths, renaming a folder orphans state. Decide ID scheme early (ULID? `<username>/<slug>`?).
- **Hot-reload conflicts with the prod load path.** Designer in dev mode is loading from disk; prod plugin loads from bundle. Unified abstraction needed — likely a "module loader" interface with two implementations.
- **Forking depends on the file-system bridge.** Browsers can't write arbitrary files. The fork action either (a) generates a CLI command for the user to run, (b) uses native messaging to a sidecar, or (c) writes to a file-handle the user grants via File System Access API. **This is a meaningful design call** — flag for ARCHITECTURE.
- **`llm()` cost visibility is a Table Stake, not just a nice-to-have.** Users self-funding the API will treat invisible calls as a bug.

---

## MVP Definition

### Launch With (v1)

Aligned with PROJECT.md "конечный сценарий" (3 designers, ≥1 experiment each, one uses `llm()` + `fetchPage()`, fork end-to-end works).

- [ ] **Experiment list view grouped by author** — primary UI surface, matches repo structure.
- [ ] **Per-experiment enable/disable toggle, persisted per-user** — non-negotiable, in PROJECT.md.
- [ ] **URL-scope matching (Chrome match-pattern + regex fallback)** — gate for apply.
- [ ] **Auto-rendered tweak UI: toggle, select, text, slider, color, multi** — full v1 set per PROJECT.md.
- [ ] **Tweak values persisted in `chrome.storage.local`** — per-user.
- [ ] **Re-apply experiment on tweak change without page reload** — needed for usable iteration.
- [ ] **Apply order visible + reorderable** — answers "why is my experiment fighting another?"
- [ ] **Toolbar badge counter** showing # active experiments on current tab.
- [ ] **Popup scoped to current tab** with toggle + tweak controls + "open in Cursor" link.
- [ ] **`llm(prompt)` helper** with per-user API key in settings, session call counter visible in popup.
- [ ] **`fetchPage(url, selector?)` helper** — service-worker-mediated, SSR only.
- [ ] **Manifest-driven build pipeline** that bundles all `experiments/*/*` into the extension (MV3 constraint).
- [ ] **Auto-generated `description.md`** via Cursor/Claude at build time; designer-editable.
- [ ] **Tweak presets** loadable from `experiments/<user>/<id>/presets/*.json`.
- [ ] **Fork action** in popup → produces a copy of an experiment under `experiments/<my-username>/<id>-fork/` (mechanism TBD — see Pitfalls).
- [ ] **Error surfacing** per experiment in popup (try/catch around `apply()`, message displayed inline).
- [ ] **Hot-reload dev mode** — file watcher on local repo, re-load experiment without full extension reload.
- [ ] **Search/filter** in experiment list.

### Add After Validation (v1.x)

Add once the v1 scenario plays end-to-end and 3+ designers are using it weekly.

- [ ] **Experiment screenshots** (auto-captured first run + checked-in optional) — trigger: list view becomes hard to scan past ~10 experiments.
- [ ] **Per-experiment git changelog in popup** — trigger: "what changed?" question recurs.
- [ ] **Apply-order conflict warnings** ("Experiment A and B both touch `.foo` — heads up") — trigger: first real conflict surfaces.
- [ ] **`.crx` auto-build via GitHub Actions on tag** — trigger: manual rebuilds become bottleneck.
- [ ] **Experiment tags / labels** — trigger: list grows beyond ~30 entries.
- [ ] **Per-experiment LLM call/cost counter (lifetime, not just session)** — trigger: a user notices unexplained API spend.

### Future Consideration (v2+)

Already in PROJECT.md "Out of Scope" or implied by it.

- [ ] **Firefox / non-Chromium support** — different manifest, polyfills.
- [ ] **Chrome Web Store distribution** — only if extension stops being closed-team.
- [ ] **Headless render for SPA `fetchPage()`** — separate sidecar product.
- [ ] **Conditional tweaks** — if v1 hits real cases where flat tweak panels become unmanageable.
- [ ] **Real LLM budget enforcement** — needs backend, only if users actually overspend.
- [ ] **Cloud sync of tweak values** — only if users start working from many devices.
- [ ] **Conflict-resolution UI** between experiments — only if visible-order is proven insufficient.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Experiment list grouped by author | HIGH | LOW | P1 |
| Enable/disable toggle | HIGH | LOW | P1 |
| URL-scope matching | HIGH | MEDIUM | P1 |
| Auto-rendered tweak UI (6 types) | HIGH | MEDIUM | P1 |
| Tweak persistence (chrome.storage.local) | HIGH | LOW | P1 |
| Re-apply on tweak change | HIGH | MEDIUM | P1 |
| Popup scoped to current tab | HIGH | LOW | P1 |
| Badge counter for active experiments | MEDIUM | LOW | P1 |
| `llm()` helper + key in settings | HIGH | MEDIUM | P1 |
| LLM session call counter | HIGH | LOW | P1 |
| `fetchPage()` helper | HIGH | MEDIUM | P1 |
| Auto-generated description.md | HIGH | MEDIUM | P1 |
| Tweak presets in repo | MEDIUM | MEDIUM | P1 |
| Fork to my folder | HIGH | MEDIUM-HIGH | P1 |
| Error surfacing in popup | HIGH | LOW | P1 |
| Hot-reload dev mode | HIGH | MEDIUM-HIGH | P1 |
| Search/filter list | MEDIUM | LOW | P1 |
| Apply-order visible + reorderable | HIGH | MEDIUM | P1 |
| Open in Cursor deep link | MEDIUM | LOW | P1 |
| Reset tweak values to defaults | MEDIUM | LOW | P1 |
| Auto-captured screenshots | MEDIUM | HIGH | P2 |
| Per-experiment git changelog | MEDIUM | LOW-MEDIUM | P2 |
| Conflict-overlap warnings | MEDIUM | MEDIUM | P2 |
| `.crx` auto-build on tag | MEDIUM | LOW-MEDIUM | P2 |
| Experiment tags | LOW (at v1 scale) | LOW | P3 |
| Lifetime LLM cost counter | MEDIUM | MEDIUM | P3 |
| Conditional tweaks | LOW | HIGH | P3 |
| Visual WYSIWYG editor | (anti) | (anti) | NO |
| Headless render SPAs | (anti) | (anti) | NO |
| Public marketplace | (anti) | (anti) | NO |
| Cross-device sync | (anti) | (anti) | NO |
| In-extension code editor | (anti) | (anti) | NO |

**Priority key:**
- P1: Must have for v1 launch (matches PROJECT.md Active list and the v1 scenario)
- P2: Should have, add when bottleneck appears
- P3: Nice to have, defer
- NO: Anti-feature, deliberately not building

---

## Competitor Feature Analysis

| Feature | Tampermonkey | Stylus | Optimizely Web / VWO | VisBug / Polypane | Our Approach |
|---------|--------------|--------|----------------------|-------------------|--------------|
| **Authoring model** | In-ext code editor; URL header `@match` | In-ext CSS editor + URL match | WYSIWYG visual editor + JS | Live DOM editing in browser, no save model | Code in Cursor with AI; bundle to extension |
| **Distribution** | Greasy Fork directory + raw URL install | Userstyles.world directory | SaaS, account-bound | Extension only (no save) | git repo + sideload `.crx` |
| **Sharing** | Public scripts; `@updateURL` for updates | Public styles; auto-update | Tied to org account | Not applicable (ephemeral) | git push; team has the repo |
| **Per-script settings** | Limited (`GM_config` 3rd-party) | Style options (color, range) — UserCSS dialect | Variant-level config in dashboard | None | First-class manifest tweaks (6 types) auto-rendered |
| **URL scoping** | `@match`, `@include`, `@exclude` | URL match, prefix, regex, domain | Page-targeting rules in UI | All pages | Match-pattern + regex |
| **Multi-script ordering** | Run order config | Style cascade (CSS native) | Mutual exclusion within campaign | n/a | Visible reorderable list |
| **Indicator on toolbar** | Badge with count | Icon color change | None (it's SaaS) | n/a | Badge with count |
| **Popup behavior** | Lists scripts matching tab | Lists styles matching tab | n/a | n/a | Lists experiments matching tab |
| **Fork / duplicate** | "Make a copy" (local list) | "Edit + save as copy" | "Duplicate variant" | n/a | "Fork to my folder" — copies into git tree |
| **AI / network helpers** | `GM_xmlhttpRequest` (no LLM) | None (CSS only) | A/B stats backend | None | `llm()` + `fetchPage()` first-class |
| **Hot reload during dev** | Save-and-reload | Live for CSS, manual for JS-of-style | Editor preview iframe | Live | File-watcher → re-apply |
| **Persistence scope** | Per-browser local + cloud sync | Per-browser local + cloud sync | Cloud-only | n/a | `chrome.storage.local` + repo presets |
| **Description / docs** | Header comments (stale-prone) | Description field | Description in dashboard | n/a | Auto-gen from code (Cursor/Claude) |
| **Conflict handling** | Designer responsibility | CSS cascade native | Mutual exclusion | n/a | Visible apply order + warnings (P2) |

---

## Sources

External research tools (WebSearch, WebFetch, gsd-sdk websearch CLI) were unavailable in this environment — all calls were denied. The following is the source basis I drew on from training-data knowledge of these products through ~2025. **Recommend a follow-up live-verification pass** before requirements freeze, particularly on: latest Tampermonkey 5.x dashboard UI, Stylus current `@match`/regex syntax, Optimizely Web's 2025 editor capabilities, and any MV3-specific changes to side-load and `.crx` auto-update policies.

- **Tampermonkey** — userscript manager: dashboard list view, `@match`/`@include`/`@exclude`, badge counter, popup scoped to tab, `GM_*` API, "Edit script" pattern, install-via-URL flow. Confidence: HIGH (well-documented stable product, but specific UI version unverified in this run).
- **Stylus** — userstyle manager: matching by URL prefix / domain / regex, popup pattern, auto-update from userstyles directory, UserCSS dialect with style options (color, range). Confidence: HIGH (similar caveat).
- **Greasy Fork / Userstyles.world** — public sharing model, `@updateURL`, fork-and-modify as a workflow. Confidence: MEDIUM.
- **VisBug** — visual page editing, no persistence model. Confidence: HIGH (official Google extension).
- **Polypane** — multi-viewport designer browser, accessibility overlays, live edit. Confidence: MEDIUM (less central to feature derivation here).
- **Optimizely Web** — visual A/B editor, variant config, campaign-level enable, page-targeting rules, mutual exclusion. Confidence: MEDIUM (commercial product, public docs, but specifics evolve).
- **VWO** — comparable to Optimizely; visual editor + targeting + variant statistics. Confidence: MEDIUM.
- **Mutiny** — personalization platform; segment-based variants. Confidence: LOW (more limited training-data exposure; informed positioning, not feature details).
- **Plasmo** — extension framework with declarative storage hooks and options-page generation, reference for "manifest → auto-rendered settings UI" pattern. Confidence: MEDIUM-HIGH.
- **Chrome Extension MV3 documentation** — `chrome.action.setBadgeText`, match-pattern format, `tabs` API, `chrome.storage.local` quotas, MV3 remote-code prohibition. Confidence: HIGH (foundational Chromium docs that drove `bundle + rebuild` decision in PROJECT.md).
- **PROJECT.md** — primary input for scope, constraints, and the v1 acceptance scenario.

---
*Feature research for: designer-experiment browser extension platform (Chromium MV3 + git monorepo + per-user API keys)*
*Researched: 2026-04-25*
