# Crust

## What This Is

Crust — браузерное расширение (Chromium-only, MV3) + git-репозиторий, в котором дизайнеры и другие члены команды держат свои "эксперименты" — JS-модули, которые применяют любые правки к чужим сайтам (CSS, JS, добавление блоков, AI-генерация контента). Эксперименты разложены по личным папкам авторов, расшариваются через git, включаются и настраиваются через UI плагина с твиками. Целевая аудитория — закрытая команда; онбординг — "склонировал репо, завёл папку под своим именем, поехал".

## Core Value

Дизайнер может в Cursor/Claude собрать любую правку чужого сайта (включая динамический AI-контент), запустить её у себя в браузере, и одной командой `git push` поделиться с коллегами — без согласований с разработчиками целевых сайтов и без своей бэкенд-инфраструктуры.

## Current State

Crust v1.1 shipped on 2026-04-28. The project now has a working Chromium MV3 extension with experiment discovery/build, popup/options UI, tweak controls, helper APIs (`llm`, `fetchPage`, side-effect helpers), dev hot-reapply, SPA/multi-experiment ordering, presets, fork/onboarding/distribution flows, Chrome/Yandex sideload acceptance, and git-private DESIGN.md site context support for AI-assisted authoring.

## Next Milestone Goals

No active milestone is defined yet. Use `$gsd-new-milestone` to choose the next product slice and create fresh requirements.

## Requirements

### Validated

- ✓ Chromium MV3 extension for Chrome/Edge/Brave/Yandex Browser — v1.1
- ✓ Git-native experiment structure under `experiments/<username>/<experiment-id>/` — v1.1
- ✓ Build-time experiment discovery, manifest validation, registry generation, and code-split chunks — v1.1
- ✓ Popup/options UI with grouped experiments, URL filtering, search, toggles, status/errors, theme support, and toolbar badge — v1.1
- ✓ Six manifest-driven tweak types with validation, persistence, reset, presets, and cleanup/apply re-run — v1.1
- ✓ Helpers for `llm()`, `fetchPage()`, side-effect cleanup, rate limiting, and LLM cost visibility — v1.1
- ✓ Dev and sharing workflows: hot-reapply, SPA reconciliation, multi-experiment ordering, Open in Cursor, fork command, onboarding, and release packaging — v1.1
- ✓ Local DESIGN.md/site context workflow for AI agents, private by default and excluded from extension runtime artifacts — v1.1

### Active

(None — next milestone not defined yet)

### Out of Scope

- **Firefox/non-Chromium браузеры (v1)** — отличающийся manifest, удваивает кодовую базу. Возможно в v2.
- **Chrome Web Store distribution** — закрытая команда, sideload через GitHub Releases (.crx) или "load unpacked" достаточно.
- **Headless-рендер для SPA-сайтов** — fetchPage работает только для server-rendered контента. Сайты с тяжёлым JS-рендером (React/Vue без SSR) в v1 не покрываем.
- **Crawl/auto-discovery страниц для AI** — дизайнер сам указывает URL в коде эксперимента, никакой логики "найди и подтяни". Страховка от рабит-холла.
- **Auto-извлечение структуры чужих блоков** — дизайнер вручную копирует HTML/CSS в Cursor при сборке эксперимента.
- **Conditional tweaks (показать твик X только если Y)** — упрощённая модель v1, всё видно всегда.
- **Резолюция конфликтов между экспериментами** — за порядок и совместимость отвечает дизайнер; v1 просто применяет в порядке включения.
- **MCP Figma интеграция при сборке эксперимента** — упомянуто в брифе, но это инструмент дизайнера в Cursor, а не часть плагина. Не строим.
- **Полноценный AI с crawl + structure extraction + LLM-render** — отложено: помимо MV3-сложности, это отдельный продукт. Покрываем только базовые helpers.
- **Per-эксперимент budget tracking / rate limiting LLM** — в v1 счётчик/предупреждение. Полный rate-limit/бюджеты — v2.
- **Web/cloud-синхронизация твиков между устройствами** — chrome.storage.local достаточно для v1.

## Context

**Происхождение идеи:** Андрей хочет дать команде дизайнеров возможность быстро итерировать поверх реальных сайтов (особенно поисковых выдач Яндекса вроде ya.ru) — без долгих согласований с разработчиками этих сайтов. Вспомогательно — дизайнеры используют Cursor/Claude Code как основной инструмент сборки, поэтому workflow строится вокруг "написал код в Cursor → собрал плагин → проверил в браузере → запушил".

**Технологический контекст:**

- MV3 (Manifest V3) запрещает исполнение удалённо загруженного JS — это определило архитектуру "bundle + rebuild + redistribute" вместо runtime-sync.
- Ya.ru и подобные поисковые выдачи большей частью server-rendered — `fetchPage` без headless будет работать.
- shadcn/ui — выбран как UI-кит плагина, чтобы интерфейс выглядел качественно из коробки.
- API-ключи LLM хранятся per-user в настройках плагина — нет центральной API-инфраструктуры (упрощает MVP, но возлагает ответственность за токены на пользователя).

**Сценарий-эталон (для проверки v1):**

> Дизайнер на странице `ya.ru/yandsearch?text=погода`. У него в плагине включён эксперимент "видеообзор-блок" другого дизайнера. Эксперимент берёт HTML-шаблон видеообзора (вшит в эксперимент), вызывает `llm("сделай контент про погоду")`, инжектит результат над выдачей. Дизайнер в твике переключает "тон: формальный" — блок ре-апплаится с новым промптом.

**Распространение:** sideload — `.crx` через GitHub Releases или "load unpacked" из локально склонированного репо. Никакого Chrome Web Store в v1.

## Constraints

- **Tech stack**: Chromium MV3, JavaScript/TypeScript, shadcn/ui (UI плагина).
- **Trust model**: closed team — JS-модули экспериментов исполняются с минимальной изоляцией (isolated world content scripts), без жёсткого sandbox. Безопасность достигается через code review при коммите, не через runtime-sandbox.
- **Distribution**: GitHub-based, sideload only (нет Chrome Web Store).
- **Browsers**: только Chromium-based в v1 (Firefox — v2+).
- **Performance**: эксперименты применяются на каждой загрузке страницы попадающей в scope — нельзя блокировать render надолго; LLM/fetch вызовы — async, не блокируют initial paint.
- **Cost**: LLM-вызовы по per-user API ключу — финансовая ответственность на пользователе; плагин обязан показывать счётчик вызовов в текущей сессии.
- **Onboarding**: новый член команды — `git clone` + создание своей папки в `experiments/` + локальная сборка плагина. Без админских действий с моей стороны.

## Key Decisions


| Decision                                                         | Rationale                                                                                            | Outcome   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| Bundle-all + rebuild plugin (вместо runtime-fetch экспериментов) | MV3 запрещает исполнение remote JS; "Refresh button" несовместима с "чистый JS-модуль" подходом      | v1.1 — Complete |
| Чистые JS-модули (вместо декларативного манифеста или гибрида)   | Закрытая команда → доверие к авторам есть; максимальная гибкость; один движок исполнения вместо двух | v1.1 — Complete |
| Chromium-only в v1                                               | 95%+ покрытие; одна кодовая база MV3; Firefox — отдельный manifest и polyfill                        | v1.1 — Complete |
| Self-service папка пользователя в `experiments/<username>/`      | Нулевой friction онбординга; не требует моих админских действий; естественная git-изоляция           | v1.1 — Complete |
| LLM helpers в плагине (`llm()`, `fetchPage()`), а не "AI-движок" | Покрывает заявленные кейсы; stateless и простые в реализации; избегаем рабит-холла полного crawl-а   | v1.1 — Complete |
| API-ключи LLM per-user в настройках плагина                      | Нет центральной инфры → нет бэкенда v1; ответственность за биллинг на пользователе                   | v1.1 — Complete |
| Описание эксперимента генерится Cursor при сборке                | Дизайнер не пишет рутину; описание актуально коду; правки опциональны                                | v1.1 — Complete |
| DESIGN.md/site context локальны по умолчанию                     | Контекст сайта может содержать reverse-engineered DOM, client notes и скриншоты; это помогает агенту, но не должно утекать в публичный git | Phase 7 — Complete |
| URL-scoping в манифесте через glob/regex                         | Стандарт для browser extensions; декларативно; видно scope при ревью                                 | v1.1 — Complete |
| Несколько экспериментов на странице → по порядку включения       | Самое простое предсказуемое поведение; конфликты — на совести дизайнера                              | v1.1 — Complete |
| Твики персистятся локально + опциональный пресет в репо          | Локально — не засоряет репо; пресет — для шаринга "вот мой recommended setup"                        | v1.1 — Complete |


## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-28 after v1.1 milestone close.*
