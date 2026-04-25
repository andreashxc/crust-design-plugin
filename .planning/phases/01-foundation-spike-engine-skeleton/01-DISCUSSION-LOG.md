# Phase 1: Foundation Spike & Engine Skeleton — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves what was actually asked and answered.

**Date:** 2026-04-25
**Phase:** 01-foundation-spike-engine-skeleton
**Areas discussed:** Smoke experiment scope (single product question)

---

## Meta

Изначально были предложены 4 технические gray area (Framework choice, Spike scope & artifacts, Manifest schema & ID strategy, Two-world routing mechanism). Пользователь явно сказал, что технические вопросы — не его уровень и должен решать Claude:

> "вопросы слишком сложные, делаем качественно и хорошо. учитываем цель, к чему хотим прийти в итоге. я могу продуктово объяснять если есть непонятки, а стек нужно осознать и сделать тебе"

Это зафиксировано как feedback memory (`feedback_no_technical_questions.md`) и user memory (`user_role.md`) для всех будущих фаз.

После обратной связи Claude:
1. Принял все технические решения самостоятельно (см. CONTEXT.md `<decisions>`), опираясь на PROJECT.md, REQUIREMENTS.md, ROADMAP.md, и `.planning/research/SUMMARY.md`.
2. Задал один продуктовый вопрос — про уровень smoke-эксперимента.

---

## Smoke Experiment Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Чистый минимум (рекомендован) | ya.ru → розовый при enable, обратно при disable. Нет твиков. Невидимый popup — просто toggle. Цель — apply→cleanup→re-apply round-trip и SW-выживаемость. Максимум фокуса на spike-выводах. | ✓ |
| Минимум + одна инъекция блока | Розовый ya.ru + хардкод HTML-блок над выдачей (без LLM). Сразу "вот как будет примерный эксперимент". Чуть больше риска (лейаут блока съест время), но видно что движок реально может movement-on-page. | |
| Два фейк-автора, два smoke | experiments/designer1/ + experiments/designer2/ с разными smoke. Popup сразу группирует по авторам. Сильно выходит на территорию Phase 2. Не рекомендован если коллаб-кейс не критичен сейчас. | |

**User's choice:** Чистый минимум.
**Notes:** Согласуется с research (Phase 1 — foundation, не feature work) и success criteria из ROADMAP.md (один smoke-эксперимент, ya.ru pink, revert on disable).

---

## Claude's Discretion

Все технические решения приняты Claude'ом без обсуждения с пользователем (по его явной просьбе). См. `01-CONTEXT.md` `<decisions>`. Категории:

- Stack & Tooling (D-01..D-08) — WXT, TypeScript, Zod, shadcn/ui, Biome, pnpm workspaces, Vitest.
- Repository Layout (D-09..D-11) — `apps/extension/`, `packages/experiment-sdk/`, `experiments/<author>/<id>/`, `tools/`, `docs/spike/`.
- Engine Architecture (D-12..D-15) — stateless SW, декларативный two-world routing, error isolation, engine contract в SDK.
- Manifest Schema (D-16..D-19) — Zod-схема v1, ULID авто-фикс при первом билде, author=папка, короткое description.
- Build Pipeline (D-20..D-22) — Vite-плагин с `import.meta.glob`, Zod-валидация на сборке, registry.json отложен до Phase 2.
- CI / Linting (D-23..D-24) — Biome + кастомная CSP-проверка, pre-commit + GitHub Actions.
- Spike Approach (D-25..D-27) — spike перерастает в foundation, итог-документ `docs/spike/MV3-FOUNDATION.md` по 5 пунктам, явная SW lifecycle проверка.
- Smoke Experiment specifics (D-28..D-29) — `experiments/andrew/smoke/`, чистый CSS, bare popup-toggle.

## Deferred Ideas

См. `<deferred>` в CONTEXT.md. Главное:
- Auto-tracked helpers → Phase 4
- Полноценный tweak движок → Phase 3
- Группировка popup по авторам, фильтр по URL, drag-and-drop → Phase 2 + Phase 5
- Hot-reload → Phase 5
- `.crx` + GitHub Releases → Phase 6
- Yandex Browser smoke → Phase 6
- Two-world bridge (CustomEvent между isolated и main одного эксперимента) → отложено до реального кейса
