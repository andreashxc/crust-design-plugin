# Milestones

## v1.1 Crust v1.1 (Shipped: 2026-04-28)

**Phases completed:** 7 phases, 44 plans, 29 tasks

**Key accomplishments:**

- Built the Chromium MV3 Crust extension foundation: experiment SDK/schema, stateless service worker, isolated/main content worlds, storage/messaging, build-time discovery, registry, code-split experiment chunks, and CSP guardrails.
- Shipped the designer-facing popup/options workflow: grouped experiments, URL filtering, search, enable/disable, error visibility, toolbar badge, theme-aware Crust UI, and shadcn-based tweak controls.
- Implemented the full tweak loop: six tweak types, validation, persistence, reset, presets, cleanup/apply re-run, Shadow DOM panel support, and multi-experiment ordering.
- Added helper infrastructure for AI experiments: per-user OpenAI/Anthropic settings, `llm()` proxy with cache/retry/counters/streaming ports, `fetchPage()`, side-effect ledger helpers, and apply rate limiting.
- Completed DX, sharing, and distribution flows: dev hot-reapply, SPA reconciliation, author/experiment drag ordering, Open in Cursor, fork command, onboarding docs, package/release scripts, and Chrome/Yandex sideload smoke.
- Added v1.1 DESIGN.md site context support: git-private context paths, parser/indexer, compact summaries, URL matching, create/fork workflow hints, and privacy checks that keep local context out of extension artifacts.

**Archive files:**

- [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

**Known notes:**

- Release packaging ships sideload-ready unpacked/zip artifacts. A signed `.crx` still requires a Chrome signing key and was not faked.
- Real provider streaming longer than 30 seconds remains a manual follow-up; runtime-port streaming is covered by automated tests.

---
