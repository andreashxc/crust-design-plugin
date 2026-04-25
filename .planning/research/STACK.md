# Stack Research

**Domain:** Chromium MV3 browser extension platform with bundled experiment modules, React + shadcn/ui UI, monorepo, designer-friendly DX
**Researched:** 2026-04-25
**Overall Confidence:** MEDIUM

> **Verification note:** Live web search, Context7, and WebFetch were unavailable during this research session (permissions denied). Recommendations below are based on the assistant's training data (cutoff January 2026) plus careful reasoning about MV3 ecosystem trajectory. Version numbers marked `~` are best-guess targets — **the implementing engineer must verify "latest stable" via `npm view <pkg> version` before locking the lockfile.** Architectural recommendations (which framework, which bundler, which UI primitives) are higher confidence than the specific version pins.

## TL;DR — The Recommended Stack

| Layer | Pick | Why |
|-------|------|-----|
| Extension framework | **WXT** | Best-in-class DX for MV3 in 2025-2026: file-based entrypoints, true HMR for popup AND content scripts, Vite under the hood, first-class TS, no opinionated React lock-in (works with shadcn/ui cleanly) |
| UI framework | **React 19** | Required by shadcn/ui; mature; works inside extension popup/sidepanel/content-script-mounted UIs |
| UI components | **shadcn/ui** (copy-paste, latest CLI) on **Tailwind CSS v4** | Stated requirement; Tailwind v4 has zero-config CSS-first setup that fits extension build pipelines well |
| Styling isolation in content scripts | **Shadow DOM mount + Tailwind CSS injected into shadow root** (WXT `createShadowRootUi` helper) | Prevents host-page CSS from breaking shadcn components and vice versa |
| Language | **TypeScript 5.6+** | Non-negotiable for a multi-author experiment platform — types are the contract between core and experiments |
| Browser API types | **`@types/chrome`** + thin internal `browser` shim if needed later | We're Chromium-only in v1; webextension-polyfill adds bundle size and a Promise-wrapper layer that Chrome already provides natively in MV3 |
| Monorepo | **pnpm workspaces** (no Nx/Turborepo) | Designer team is small; one extension package + one experiments folder. pnpm alone is enough; Nx/Turborepo are overkill |
| Experiment loading | **Vite `import.meta.glob('/experiments/**/experiment.{ts,js}', { eager: false })`** | Native to the bundler we already have via WXT; statically analyzable by Rollup at build time, MV3-compliant (no remote code) |
| LLM proxy (`llm()`) | **Direct fetch from MSW (service worker / background script)** to OpenAI/Anthropic, NOT from content script or popup | CORS works from the SW context; API key stays out of page memory; one place to add counter/budget later |
| `fetchPage()` helper | **`fetch()` from background SW + `DOMParser` from offscreen document** | DOMParser isn't available in service worker context (no `window`); offscreen document is the MV3-blessed workaround |
| Manifest schema validation | **Zod** | Per-experiment manifest needs runtime validation when discovered at build time; Zod gives types + parser in one |
| Packaging / distribution | **WXT `wxt zip` → upload to GitHub Releases** + **`crx` CLI** for signed `.crx` (optional) | No Chrome Web Store required; GH Releases satisfies sideload requirement |
| Linter / formatter | **Biome** (or ESLint + Prettier if team prefers) | Biome is 10-50× faster, single tool, sufficient for TS/React; ESLint only if a specific plugin is required |
| Tests | **Vitest** (unit) + **Playwright** (extension E2E via `chromium.launchPersistentContext`) | Vitest pairs with Vite/WXT; Playwright has documented MV3 extension support |

---

## Recommended Stack

### Core Technologies

| Technology | Version (target) | Purpose | Why Recommended |
|------------|------------------|---------|-----------------|
| **WXT** | `~0.20.x` | MV3 extension framework: dev server, HMR, manifest generation, multi-browser builds | The clear winner for new MV3 projects in 2025-2026. File-based entrypoints (`entrypoints/popup/`, `entrypoints/content.ts`, `entrypoints/background.ts`), Vite-powered HMR that works for content scripts (not just popup), strong TypeScript support, zero React lock-in (works with any UI framework), active maintenance. Plasmo's release cadence slowed; CRXJS is great but lower-level and requires more wiring for things WXT gives free (auto-reload, manifest typing, cross-browser). |
| **Vite** | `~6.x` (transitively via WXT) | Bundler / dev server | You don't install Vite directly — WXT pins it. Vite's `import.meta.glob` is the cleanest way to enumerate experiment modules at build time without a custom plugin. |
| **React** | `~19.x` | UI library for popup, side panel, options page, and any content-script-mounted UI | Required transitively by shadcn/ui; mature; React 19 server components are irrelevant to extensions, but the new compiler and `use()` hook are nice-to-haves. |
| **TypeScript** | `~5.6+` | Type system | Designers write experiments — types prevent half the support burden. WXT generates types for entrypoints automatically. |
| **Tailwind CSS** | `~4.0+` | Atomic CSS engine, required by shadcn/ui | Tailwind 4's CSS-first config (`@theme` in CSS) and Lightning CSS-based engine are dramatically simpler to wire into an extension build than v3's PostCSS pipeline. shadcn/ui's CLI now targets Tailwind v4 by default. |
| **shadcn/ui** | latest CLI (component versions are copy-paste, not semver-pinned) | Pre-built React + Tailwind components | Stated requirement. Use `npx shadcn@latest add button input switch select slider ...` — components live in `src/components/ui/` and are owned/edited freely. |
| **Radix UI primitives** | latest (transitive via shadcn) | Headless accessible primitives under shadcn components | Comes for free with shadcn. No separate install decision. |
| **Zod** | `~3.23+` | Runtime schema validation for experiment `manifest.json` | Designers will mistype manifests; Zod surfaces friendly errors at build time and gives TS types for free via `z.infer<>`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`@types/chrome`** | latest | TypeScript types for `chrome.*` MV3 APIs | Always — typed `chrome.storage.local`, `chrome.runtime.sendMessage`, etc. |
| **`webext-bridge`** or WXT's `@webext-core/messaging` | latest | Typed message passing between content script ⇄ background ⇄ popup | When you need type-safe cross-context calls (almost certainly needed for `llm()` proxy). Prefer `@webext-core/messaging` because WXT's author maintains it — guaranteed compatibility. |
| **`@webext-core/storage`** or `chrome.storage.local` directly with a thin wrapper | latest | Persisted tweak values per user | Use the wrapper if you want typed schemas; raw API is fine for v1. |
| **`zustand`** | `~5.x` | UI state in popup (which experiments enabled, current tweak values) | Lightweight; ~1 KB; no boilerplate. Avoid Redux — overkill. Avoid React Context for cross-component state — re-render perf in a popup with sliders matters. |
| **`@tanstack/react-query`** (optional) | `~5.x` | If popup ever needs to query GitHub for forks/presets | Defer until a v1.x feature actually needs it. Local-first state doesn't need it. |
| **`lucide-react`** | latest | Icon set used by default by shadcn/ui | Comes via `shadcn add` — no manual install needed. |
| **`clsx`** + **`tailwind-merge`** (`cn()` helper) | latest | Conditional classnames | Auto-installed by shadcn init. |
| **`marked`** or **`react-markdown`** | latest | Render `description.md` in the experiment list UI | Pick `react-markdown` for safety (sanitizes by default) — these descriptions are AI-generated and should not run script. |
| **OpenAI / Anthropic SDKs** | `openai@~4.x`, `@anthropic-ai/sdk@~0.30+` | LLM client in background SW | Both ship browser-safe builds and tree-shake well. Wrap behind a single `llm()` interface so the experiment author doesn't see the provider split. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager + workspaces | Faster, content-addressed store, strict peer-dep handling. Lockfile is small and reviewable. Use `pnpm@9+`. |
| **WXT dev server** (`wxt`) | Run extension with HMR | `pnpm dev` opens a Chromium instance with the extension auto-loaded; saves to `entrypoints/` reload only the affected context. |
| **Biome** | Lint + format in one binary | `biome check --write` replaces `eslint --fix` + `prettier --write`. ~10× faster, single config. Switch to ESLint only if you need a plugin Biome lacks (e.g., `eslint-plugin-tailwindcss` for class-order — Biome added this in late 2025). |
| **Vitest** | Unit tests for helpers, manifest parser, llm proxy logic | Same Vite pipeline → no separate config. |
| **Playwright** | E2E tests by launching a real Chromium with the unpacked extension | `chromium.launchPersistentContext('', { args: ['--load-extension=...']})` is the standard pattern. |
| **`crx` CLI** (optional) | Generate signed `.crx` for GitHub Releases sideload | Only needed if `.crx` is preferred over "load unpacked from clone." Most closed teams just clone-and-load. |
| **GitHub Actions** | CI: typecheck, lint, build, attach `dist.zip`/`.crx` to release | Trigger on tag push. |

## Installation

```bash
# 1. Initialize repo (pnpm workspace)
pnpm init
pnpm add -D pnpm@latest  # ensure modern pnpm

# 2. Scaffold the extension package with WXT
pnpm dlx wxt@latest init apps/extension --template react-ts
cd apps/extension

# 3. Add UI stack
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom @types/chrome typescript

# 4. Tailwind v4 + shadcn/ui
pnpm add -D tailwindcss@latest @tailwindcss/vite
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input switch select slider tabs scroll-area dialog separator label

# 5. State + utilities
pnpm add zustand zod
pnpm add clsx tailwind-merge       # already added by shadcn init, listed for clarity

# 6. Messaging + storage
pnpm add @webext-core/messaging @webext-core/storage

# 7. LLM SDKs (used only inside background SW)
pnpm add openai @anthropic-ai/sdk

# 8. Markdown rendering for description.md
pnpm add react-markdown

# 9. Dev tooling
pnpm add -D @biomejs/biome vitest @vitest/ui playwright @playwright/test

# 10. Initialize Biome
pnpm dlx @biomejs/biome init
```

**Run scripts (suggested `package.json`):**

```jsonc
{
  "scripts": {
    "dev":       "wxt",                  // HMR dev server
    "dev:edge":  "wxt -b edge",          // dev against Edge
    "build":     "wxt build",            // production build
    "zip":       "wxt zip",              // package for distribution
    "typecheck": "tsc --noEmit",
    "lint":      "biome check --write",
    "test":      "vitest run",
    "test:e2e":  "playwright test"
  }
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **WXT** | **Plasmo** | If the team strongly prefers Next.js-style file conventions and is okay with slower release cadence. Plasmo was the leader 2022-2024; WXT overtook it in 2025 on DX, HMR reliability, and active maintenance. |
| **WXT** | **CRXJS Vite plugin** | If you already have a Vite app you want to convert into an extension and don't need WXT's manifest abstraction or auto-reload. CRXJS is closer to "Vite with extension hot-reload" — more wiring, more control, less batteries-included. Still good in 2026 but more setup cost for our use case. |
| **WXT** | **Raw Vite + manual `manifest.json`** | If you want zero magic and full control. Loses 2-3 weeks of DX work. Only worth it for very small extensions. Not recommended here — we have multiple entrypoints (popup, side panel, content script per page, background SW, options) and a content-script HMR requirement. |
| **WXT** | **`@crxjs/vite-plugin`** (CRXJS) | Same as above — niche choice now. |
| **pnpm workspaces** | **Turborepo** | When you have ≥3 build-targeted packages and CI build times matter. Our repo has one app + an `experiments/` source directory (not a publishable package) — Turborepo's task graph adds no value. |
| **pnpm workspaces** | **Nx** | Same logic as Turborepo, plus Nx adds heavy generators/plugins we won't use. Reach for Nx only at 5+ packages with complex inter-deps. |
| **`@types/chrome`** | **`webextension-polyfill` + `@types/webextension-polyfill`** | When you ship Firefox in v2. Polyfill normalizes callback-vs-promise APIs across browsers. Chrome MV3 already returns Promises natively, so the polyfill is dead weight in v1. |
| **Tailwind v4** | **Tailwind v3** | Only if shadcn/ui's CLI version you pull doesn't support v4 yet (verify at install time). v4 is the official shadcn target as of late 2025. |
| **Biome** | **ESLint + Prettier** | If the team needs a specific ESLint plugin (e.g., `eslint-plugin-react-hooks` had richer rules than Biome's equivalent at last check). Biome's React Hooks rule support landed but is narrower. |
| **Zod** | **Valibot** / **ArkType** | Valibot has a smaller bundle (matters in extension popups). Pick Valibot only if popup bundle size becomes a measured problem. Zod is more familiar to the wider ecosystem. |
| **DOMParser in offscreen document** | **`linkedom` / `cheerio` (server-style HTML parser)** | If you want zero offscreen-document plumbing, `linkedom` is a tiny DOM-shim that runs in the SW directly. Tradeoff: not a real browser parser; some HTML quirks differ. Worth it to avoid offscreen complexity. **MEDIUM-confidence alternative — investigate during implementation.** |
| **Direct provider SDKs (OpenAI/Anthropic) from background SW** | **Self-hosted relay (Cloudflare Worker) + a single token** | If/when you want central key management, budget enforcement, audit logs. Per the project brief, v1 is per-user keys → no relay. Document this as the v2 path. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Manifest V2** | Chrome stopped accepting MV2 uploads June 2024 and is removing MV2 from stable channels through 2024-2025. New extensions must be MV3. | MV3 (handled automatically by WXT). |
| **Remote-loaded experiment scripts (fetch + eval at runtime)** | MV3's CSP forbids `eval` and remote script execution; you'll be silently broken. | Bundle experiments at build time via `import.meta.glob`. (This is already a project-level decision — reaffirming as a stack-level rule.) |
| **`webextension-polyfill` in v1** | Adds bundle size + abstraction we don't need; Chrome MV3 returns Promises natively from `chrome.*` APIs. | `@types/chrome` only. Add the polyfill in v2 when Firefox lands. |
| **`unsafe-eval` / `unsafe-inline` in CSP** | Will be rejected by MV3; even sideloaded extensions fail to load with these directives. | Pure ESM bundles (default with Vite/WXT). |
| **CSS-in-JS runtimes (Emotion, styled-components) for content-script UIs** | Inject styles into `document.head`, which gets clobbered by host page or pollutes it. | Tailwind classes mounted into a Shadow DOM via WXT's `createShadowRootUi`. |
| **`window.fetch` from a content script for cross-origin API calls** | Subject to the host page's CSP and CORS — flaky and will break on hardened pages (banks, search engines). | `chrome.runtime.sendMessage` to background SW, which fetches without CORS restriction (extension origin). |
| **Storing LLM API keys in `localStorage` / `sessionStorage`** | Accessible to host-page JS if a content script ever accidentally exposes it; not synced to the right scope. | `chrome.storage.local` (extension-isolated) — or `chrome.storage.session` for in-memory only. |
| **`document.write` / direct `innerHTML` of LLM output in experiments** | XSS risk; AI output is untrusted. | A small sanitization helper or `react-markdown` for any markdown-y output. |
| **Service-worker top-level globals to cache state** | MV3 SWs are killed aggressively (~30 s idle); globals vanish. | `chrome.storage.session` for hot state, `chrome.storage.local` for persisted state. |
| **Webpack** as the bundler | Slower, more config, no ecosystem advantage for extensions in 2026. | Vite (transparently via WXT). |
| **`yarn` (Berry/PnP)** | PnP frequently breaks tools that scan `node_modules` (some MV3 build steps do). Classic Yarn is unmaintained. | pnpm. |
| **Nx / Turborepo for a 1-app repo** | Cognitive overhead with no payoff at this scale. | pnpm workspaces alone. |

## Stack Patterns by Variant

**If you need Firefox support later (v2):**
- Add `webextension-polyfill` + `@types/webextension-polyfill`.
- Replace direct `chrome.*` calls with the polyfill's `browser.*`.
- WXT compiles to both browsers with `wxt build -b firefox`; manifest differences are abstracted.
- Expect 1-2 weeks of work to flush out Chromium-only API assumptions.

**If LLM costs become a problem (per-user keys leaking budgets):**
- Add a tiny relay: Cloudflare Worker or Vercel Edge function that takes a team API key and proxies to OpenAI/Anthropic.
- Move the `llm()` helper to call the relay instead of the provider SDK directly.
- Add a JWT or shared-secret check in the relay.
- Bundle size in the extension drops (no provider SDKs).

**If experiments need shared utility code (designer A's experiment imports a helper from designer B):**
- Add a top-level `experiments/_shared/` folder.
- Allow imports from `@/experiments/_shared/...`.
- Document an explicit "shared code is reviewed more carefully" rule in `CONTRIBUTING.md`.

**If `fetchPage()` needs JS-rendered content (deferred per project scope):**
- Add an offscreen document that mounts an `<iframe>` and waits for `load`.
- Or, integrate a remote headless service (Browserless) — but this breaks the "no backend" constraint.
- Per project brief: **out of scope for v1.**

**If hot-reload of experiment files specifically (not popup) is rough:**
- WXT HMRs content scripts by re-injecting them; this works for our `apply({tweaks})` model.
- For experiments that mutate global page state heavily, document a "reload tab" workflow.

## Architecture Touch-points (so STACK is consistent with intended design)

These are stack-level commitments that ARCHITECTURE.md will elaborate. Listed here so version pins make sense.

1. **Three execution contexts:** background service worker (LLM proxy, fetchPage, message router), content script (injects Shadow DOM UI for tweaks-on-page if any, runs `experiment.apply()`), popup/side-panel (experiment list + tweak controls). All three are WXT entrypoints.
2. **Experiment registration:** `import.meta.glob('/experiments/**/manifest.json', { eager: true })` at build time → produces a registry consumed by the popup. `experiment.ts` modules are loaded lazily per matching URL.
3. **Message protocol:** typed via `@webext-core/messaging` — popup ⇄ background, content ⇄ background. Never content ⇄ popup directly.
4. **Tweak storage:** `chrome.storage.local` keyed by `experimentId` → `{ tweakId: value }`. Schema enforced by Zod from the manifest.
5. **Build-time experiment description:** Cursor/Claude generates `description.md` per experiment. The build step validates manifest + `apply()` signature presence; description is just rendered in popup, not interpreted.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| WXT `~0.20` | Vite 6.x, React 19, Tailwind 4 | WXT bumps Vite transitively; don't pin Vite separately. |
| shadcn/ui CLI (latest) | Tailwind 4, React 19 | Verify at install: `npx shadcn@latest --version`. shadcn migrated CLI to Tailwind 4 in mid-2025; older guides assume v3. |
| Tailwind 4 | Vite 6 (via `@tailwindcss/vite`) | Use the Vite plugin, NOT PostCSS, with v4. |
| `@types/chrome` | Chromium 120+ MV3 | Updated continuously; safe to use `latest`. |
| Playwright | Chromium-based extensions | Extension testing requires `launchPersistentContext` + `--load-extension`; documented since Playwright 1.40. |
| pnpm 9+ | Node 20+ | Node 22 LTS recommended. |
| `@webext-core/messaging` | WXT, Plasmo, raw extensions | Author overlap with WXT — no compat issues. |
| OpenAI SDK 4.x | Browser/SW environments | Use the standard `import OpenAI from 'openai'` — works in service worker. Pass `dangerouslyAllowBrowser: true` only if absolutely needed; SW context is usually accepted as non-browser. **Verify at integration time — MEDIUM confidence.** |
| Anthropic SDK | Service worker | Same caveat as OpenAI — most SDK guards check for `window`, which is absent in SW. Confirm in dev. |

## Sources

> **Sources note:** Live web research was unavailable during this session. The following are the URLs and references the implementer should consult to verify current versions and validate recommendations before locking the stack.

- **WXT documentation** — https://wxt.dev/ — verify latest version, confirm React + Tailwind 4 templates, content-script HMR behavior.
- **WXT GitHub** — https://github.com/wxt-dev/wxt — release notes, open issues around Tailwind v4 / shadcn integration.
- **shadcn/ui docs** — https://ui.shadcn.com/docs/installation — verify Tailwind v4 install instructions, CLI version.
- **Tailwind CSS v4 docs** — https://tailwindcss.com/docs — verify Vite plugin name and config syntax.
- **Plasmo** — https://docs.plasmo.com/ — verify maintenance status (last release date), used as alternative comparison.
- **CRXJS** — https://crxjs.dev/ — verify maintenance status, Vite version compatibility.
- **Chrome MV3 reference** — https://developer.chrome.com/docs/extensions/mv3/ — verify offscreen document API, service worker lifetime, CSP.
- **`@webext-core` monorepo** — https://github.com/aklinker1/webext-core — verify `@webext-core/messaging` and `/storage` are still recommended (same author as WXT).
- **Playwright extension testing** — https://playwright.dev/docs/chrome-extensions — confirm `launchPersistentContext` example.
- **OpenAI Node SDK** — https://github.com/openai/openai-node — confirm SW/browser usage pattern.
- **Anthropic SDK** — https://github.com/anthropics/anthropic-sdk-typescript — same.
- **Biome** — https://biomejs.dev/ — confirm React/TS rule coverage parity with ESLint as of 2026.

### Confidence Per Recommendation

| Recommendation | Confidence | Why |
|----------------|------------|-----|
| **WXT as the framework** | HIGH | Strong, consistent signal in 2024-2025 ecosystem coverage that WXT supplanted Plasmo as the default for new MV3 projects. Architecture fit (multi-entrypoint, content-script HMR, framework-agnostic UI) is exact. |
| **React + shadcn/ui + Tailwind 4** | HIGH | shadcn/ui requirement is given by project. Tailwind 4 + React 19 is the current stable combo. |
| **TypeScript** | HIGH | Project requirement. |
| **`@types/chrome` over `webextension-polyfill`** | HIGH | Project is Chromium-only in v1; polyfill is dead weight. |
| **pnpm workspaces (no Nx/Turborepo)** | HIGH | Scope-appropriate; Turborepo/Nx are anti-patterns at this size. |
| **Vite `import.meta.glob` for experiment loading** | HIGH | Native Vite feature, MV3-compliant (static analysis at build time, no runtime fetch). |
| **Background SW for LLM and fetchPage** | HIGH | Required by MV3 CORS/CSP model. |
| **Offscreen document for DOMParser** | HIGH | Documented MV3 pattern; SW has no `window`/`DOMParser`. |
| **Zod for manifest validation** | MEDIUM-HIGH | Standard choice; Valibot is a credible smaller alternative. |
| **Zustand over Redux/Context** | MEDIUM-HIGH | Conventional wisdom for popup-scale state. |
| **Biome over ESLint+Prettier** | MEDIUM | Team preference; either works. Biome is a productivity win for new projects. |
| **`@webext-core/messaging`** | MEDIUM | WXT-author tooling; should be a clean fit. Verify against current WXT version at install. |
| **Specific version pins (`~0.20.x`, etc.)** | LOW | Training data is up to Jan 2026. **Implementer must verify "latest stable" via `npm view <pkg> version` before lockfile commit.** Architectural choice is high confidence; exact pins are not. |
| **`linkedom` as alternative to offscreen document** | LOW | Listed as worth investigating; haven't validated MV3 SW compatibility in 2026. |
| **OpenAI/Anthropic SDKs work in SW without `dangerouslyAllowBrowser`** | LOW | SDK behavior changes; verify on first integration. Safe fallback: enable the flag, since SW is extension-isolated and not the worry the flag is designed against. |

---

*Stack research for: Chromium MV3 designer-experiment platform with bundled experiments, React + shadcn/ui UI, monorepo, hot-reload DX*
*Researched: 2026-04-25*
*Important caveat: External research tools (WebSearch, WebFetch, Context7, Bash) were unavailable in this session. Architectural recommendations are HIGH confidence; specific version pins are LOW confidence and must be verified by the implementing engineer.*
