# Requirements: Designer Experiment Platform

**Defined:** 2026-04-25
**Core Value:** Дизайнер может в Cursor/Claude собрать любую правку чужого сайта (включая динамический AI-контент), запустить её у себя в браузере, и одной командой `git push` поделиться с коллегами — без согласований с разработчиками целевых сайтов и без своей бэкенд-инфраструктуры.

## v1 Requirements

### Engine — ядро движка экспериментов

- [ ] **ENG-01**: Расширение собирается под Chromium MV3 и устанавливается через "load unpacked" или sideload `.crx`
- [ ] **ENG-02**: Service worker не хранит in-memory состояние — всё персистится в `chrome.storage.local` (выживает SW termination через ~30s idle)
- [ ] **ENG-03**: Engine поддерживает routing экспериментов между isolated-world и MAIN-world по полю в манифесте эксперимента
- [ ] **ENG-04**: Engine реализует контракт `apply({tweaks, helpers, currentURL, log, signal}) → cleanup` для каждого эксперимента
- [ ] **ENG-05**: Engine оборачивает каждый `apply()`/`cleanup()` в try/catch — ошибка одного эксперимента не ломает другие
- [ ] **ENG-06**: Engine авто-отключает эксперимент после N ошибок за T секунд и показывает причину в popup
- [ ] **ENG-07**: Engine патчит `history.pushState`/`replaceState` для повторного применения экспериментов на SPA-навигации
- [ ] **ENG-08**: Engine использует общий MutationObserver с debounce и тегирует свои инжекции `data-exp-id`, чтобы избежать infinite-loop
- [ ] **ENG-09**: Engine применяет несколько экспериментов на странице в порядке включения, видимом в popup; пользователь может перепорядочить через drag-and-drop

### Build — сборка плагина и discovery экспериментов

- [ ] **BLD-01**: Сборка плагина обнаруживает эксперименты в `experiments/<username>/<experiment-id>/` через `import.meta.glob` (статически, без runtime fetch — соответствует MV3 CSP)
- [ ] **BLD-02**: Каждый эксперимент проходит Zod-валидацию манифеста при сборке, ошибочный валится с понятным сообщением до билда
- [ ] **BLD-03**: Сборка генерирует артефакт `dist/registry.json` с агрегированным списком экспериментов (id, autor, scope, tweaks-схема, путь к чанку)
- [ ] **BLD-04**: Каждый эксперимент бандлится в отдельный code-split chunk, чтобы content script подгружал только нужные
- [ ] **BLD-05**: CI lint падает при использовании `eval`, `new Function`, динамических `import("https://...")` (нарушают MV3 CSP)
- [ ] **BLD-06**: Команда `pnpm build` производит сборку готовую к sideload (распакованная директория) и `.crx` для GitHub Releases

### Manifest — формат эксперимента

- [ ] **MAN-01**: Манифест эксперимента — `manifest.json` с полями: `id`, `name`, `author`, `description`, `scope` (URL-паттерны), `world` (`isolated`|`main`), `tweaks[]` (декларативная схема)
- [ ] **MAN-02**: URL-scope поддерживает glob-паттерны Chrome match-patterns + regex fallback
- [ ] **MAN-03**: Стабильный ID эксперимента — генерируется ULID при первой сборке, фиксируется в манифесте; не привязан к пути папки (rename не ломает state)
- [ ] **MAN-04**: TypeScript-типы `ExperimentManifest`, `ApplyArgs`, `Helpers` экспортируются из общего пакета и импортируются авторами для автокомплита в Cursor

### Tweaks — настройки экспериментов

- [ ] **TWK-01**: Поддерживаются 6 типов твиков: `toggle`, `select`, `text`, `number-slider`, `color`, `multi-select`
- [ ] **TWK-02**: Popup автоматически рендерит контролы твиков из манифеста через shadcn/ui (Switch, Select, Input, Slider, и т.д.)
- [ ] **TWK-03**: Значения твиков валидируются через Zod при входе в `apply()`; невалидные — `apply()` не вызывается, ошибка в popup
- [ ] **TWK-04**: Ввод text/number дебаунсится 250-500ms; toggle/select/color применяются мгновенно
- [ ] **TWK-05**: Кнопка "Reset to defaults" возвращает все твики эксперимента к дефолтам из манифеста
- [ ] **TWK-06**: Изменение твика триггерит вызов cleanup() + apply() с новыми значениями без перезагрузки страницы
- [ ] **TWK-07**: Значения твиков персистятся в `chrome.storage.local` per-user; не уходят в репо
- [ ] **TWK-08**: Дизайнер может сохранить текущие значения твиков как пресет в `experiments/<user>/<id>/presets/<preset-name>.json`; пресеты подгружаются через UI плагина

### UI — popup плагина

- [ ] **UI-01**: UI плагина построен на shadcn/ui (React 19 + Tailwind CSS v4) для popup и options page
- [ ] **UI-02**: In-page UI экспериментов (если эксперимент инжектит панели) монтируется в Shadow DOM — Tailwind preflight не загрязняет хост-страницу; Radix portals настроены на shadow root
- [ ] **UI-03**: Popup показывает список экспериментов, сгруппированных по автору (`experiments/<username>/...`)
- [ ] **UI-04**: Каждый эксперимент в popup имеет toggle (вкл/выкл), индикатор статуса (применён / ошибка / отключён)
- [ ] **UI-05**: Popup отфильтрован по текущему URL (показывает только эксперименты, scope которых матчится на текущей вкладке)
- [ ] **UI-06**: Поиск по списку экспериментов (по имени, автору, описанию)
- [ ] **UI-07**: Toolbar badge показывает количество активных экспериментов на текущей вкладке
- [ ] **UI-08**: Ошибки экспериментов показываются в popup per-эксперимент (краткое сообщение + раскрытый стектрейс по клику)

### Helpers — встроенные функции для экспериментов

- [ ] **HLP-01**: Helper `await llm(prompt, options?)` — proxy на OpenAI/Anthropic API; запрос идёт через service worker, API-ключ хранится в options page и недоступен content script'у
- [ ] **HLP-02**: `llm()` кеширует результаты по хешу промпта (in-memory + storage), чтобы избежать повторных вызовов
- [ ] **HLP-03**: `llm()` имеет retry с exponential backoff (max 3 attempts) и max-tokens лимит из конфигурации
- [ ] **HLP-04**: Engine форсирует rate-limit на `apply()` каждого эксперимента (`apply()` вызывается не чаще раза в N мс) — защита от LLM-runaway в MutationObserver
- [ ] **HLP-05**: Popup показывает счётчик LLM-вызовов и потраченных токенов в текущей сессии (визуальная защита от случайных $200 счетов)
- [ ] **HLP-06**: Helper `await fetchPage(url, selector?)` — fetch HTML из service worker (CORS bypass через host_permissions), парсинг через offscreen document с DOMParser
- [ ] **HLP-07**: `fetchPage()` детектирует SPA-shell (нет реального контента в HTML) и возвращает понятную ошибку, а не пустой результат
- [ ] **HLP-08**: Helpers `injectStyle()`, `injectNode()`, `waitFor()`, `onUrlChange()` авто-трекают side effects в per-эксперимент ledger; engine вызывает их при cleanup без участия дизайнера
- [ ] **HLP-09**: Streaming LLM-ответы поддерживаются через long-lived chrome.runtime port; SW keep-alive поддерживается во время стрима

### DX — Developer Experience

- [ ] **DX-01**: В dev-режиме file-watcher детектит изменения файлов экспериментов и шлёт `RE_APPLY_EXPERIMENT` сообщение в content script; эксперимент перезагружается без full reload расширения
- [ ] **DX-02**: HMR popup UI работает (стандартный Vite HMR)
- [ ] **DX-03**: Описание эксперимента (`description.md`) генерируется автоматически Cursor/Claude при сборке; читает код эксперимента и заполняет файл; дизайнер может редактировать вручную; staleness warning в popup, если код новее description-а
- [ ] **DX-04**: Скрипт `pnpm dev` запускает WXT в dev-режиме с auto-reload и подключает devtools панель
- [ ] **DX-05**: Документация по онбордингу: `git clone` → создать папку `experiments/<my-username>/` → `pnpm dev` → загрузить расширение в `chrome://extensions` → готово

### Sharing — обмен экспериментами

- [ ] **SHR-01**: Каждый член команды самоонбордится через создание собственной папки `experiments/<my-username>/`; нет админских действий со стороны мейнтейнера
- [ ] **SHR-02**: После `git pull` других дизайнеров их эксперименты появляются в popup после `pnpm build` или dev-reload
- [ ] **SHR-03**: Кнопка "Fork to my folder" в popup копирует чужой эксперимент в свою папку — для v1 через clipboard + shell-команду показанную дизайнеру; user-friendly, не требует File System Access API
- [ ] **SHR-04**: Кнопка "Open in Cursor" в popup для каждого эксперимента — открывает папку эксперимента в Cursor через `cursor://` URL handler

### Distribution — распространение

- [ ] **DIST-01**: GitHub Releases workflow: `wxt zip` создаёт артефакт `.crx` + распакованный zip при push tag; команда устанавливает через "load unpacked" из распакованного zip
- [ ] **DIST-02**: При запуске плагина проверяется версия, в popup показывается "update available" банер если новая версия в репо (sideload не имеет авто-обновления)
- [ ] **DIST-03**: Smoke-тест в Yandex Browser перед v1 release — проверяем что sideload работает, host_permissions для ya.ru корректны

### Acceptance — критерий v1 готовности

- [ ] **ACC-01**: 3 пользователя в `experiments/` (designer1, designer2, designer3), у каждого ≥1 эксперимент
- [ ] **ACC-02**: Минимум 1 эксперимент использует `llm()` для динамической генерации контента
- [ ] **ACC-03**: Минимум 1 эксперимент использует `fetchPage()` для подтягивания контента с другой страницы того же домена
- [ ] **ACC-04**: Минимум 1 эксперимент имеет твики 3+ типов и работает корректно при их изменении
- [ ] **ACC-05**: Сценарий "fork experiment of designer1 to designer2's folder" работает end-to-end через UI
- [ ] **ACC-06**: Сценарий "designer1 включает свой эксперимент + чужой эксперимент designer2 на одной странице, переставляет порядок" работает корректно
- [ ] **ACC-07**: Sideload в Chrome + Yandex Browser работает; описанная процедура онбординга (clone → pnpm dev → load unpacked) выполняется новым пользователем за <15 минут

## v2 Requirements

Отложено для будущих релизов. Зафиксировано, не входит в текущий roadmap.

### Браузеры
- **V2-FF-01**: Поддержка Firefox (отдельный manifest, webextension-polyfill)
- **V2-FF-02**: Поддержка не-Chromium браузеров через polyfill

### Distribution
- **V2-DIST-01**: Chrome Web Store distribution
- **V2-DIST-02**: Auto-update через `update_url` или Web Store

### Helpers
- **V2-HLP-01**: Headless-рендер для SPA-сайтов в `fetchPage()` (offscreen iframe или sidecar service)
- **V2-HLP-02**: Crawl multiple pages с auto-discovery URL для AI-экспериментов
- **V2-HLP-03**: Real LLM budget enforcement — серверный rate-limiter с per-user квотами

### UX
- **V2-UI-01**: Auto-captured screenshots экспериментов при `pnpm dev` (для visual list)
- **V2-UI-02**: Per-experiment git changelog в popup
- **V2-UI-03**: Apply-order conflict warnings (engine детектит когда 2 эксперимента трогают один селектор)
- **V2-UI-04**: Conditional tweaks (показать твик X только если Y == значение)
- **V2-UI-05**: Cross-device sync твиков через chrome.storage.sync

### Sharing
- **V2-SHR-01**: Fork via zip download в браузере
- **V2-SHR-02**: Fork via GitHub PAT + REST API создание PR

### MCP / интеграции
- **V2-MCP-01**: MCP Figma интеграция для автоматического экспорта дизайн-токенов в эксперимент

## Out of Scope

Явно исключено. Зафиксировано чтобы предотвратить scope creep.

| Feature | Reason |
|---------|--------|
| Visual WYSIWYG editor | Не цель — мы инфраструктура для код-фёрст работы дизайнеров в Cursor, а не Webflow |
| In-extension code editor | Cursor — наш редактор, не пытаемся его заменить |
| Public experiment marketplace | Закрытая команда, GitHub access — точка контроля |
| Real-time collaborative editing | Git диктует модель совместной работы; live-collab вне scope |
| Conditional tweaks (v1) | Усложняет UI без явного запроса; v2 если упрёмся |
| Cross-device tweak sync (v1) | chrome.storage.local достаточно для одной машины |
| Visual conflict resolution UI | За композицию отвечает дизайнер; engine просто применяет в порядке |
| Headless рендер для SPA сайтов в fetchPage | Сложно, требует sidecar; v1 — только SSR-страницы |
| Auto-discovery URL для crawl | Открывает рабит-холл; в v1 дизайнер сам указывает URL |
| Auto-извлечение структуры чужих блоков | Дизайнер копирует HTML вручную в Cursor при сборке эксперимента |
| Web Store distribution (v1) | Закрытая команда, sideload решает |
| Firefox/не-Chromium в v1 | Удваивает кодовую базу |
| Полноценный backend для LLM-биллинга | Каждый дизайнер платит за свой API-ключ; нет инфры — нет проблемы |

## Traceability

Каждое v1 требование смаппено ровно в одну фазу. Покрытие 100% (63/63), сирот нет.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENG-01 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| ENG-02 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| ENG-03 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| ENG-04 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| ENG-05 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| ENG-06 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| ENG-07 | Phase 5: DX, SPA Composition & Sharing | Pending |
| ENG-08 | Phase 5: DX, SPA Composition & Sharing | Pending |
| ENG-09 | Phase 5: DX, SPA Composition & Sharing | Pending |
| BLD-01 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| BLD-02 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| BLD-03 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| BLD-04 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| BLD-05 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| BLD-06 | Phase 6: Distribution & Acceptance | Pending |
| MAN-01 | Phase 1: Foundation Spike & Engine Skeleton | Pending |
| MAN-02 | Phase 3: Tweak System | Pending |
| MAN-03 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| MAN-04 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| TWK-01 | Phase 3: Tweak System | Pending |
| TWK-02 | Phase 3: Tweak System | Pending |
| TWK-03 | Phase 3: Tweak System | Pending |
| TWK-04 | Phase 3: Tweak System | Pending |
| TWK-05 | Phase 3: Tweak System | Pending |
| TWK-06 | Phase 3: Tweak System | Pending |
| TWK-07 | Phase 3: Tweak System | Pending |
| TWK-08 | Phase 5: DX, SPA Composition & Sharing | Pending |
| UI-01 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| UI-02 | Phase 3: Tweak System | Pending |
| UI-03 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| UI-04 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| UI-05 | Phase 3: Tweak System | Pending |
| UI-06 | Phase 5: DX, SPA Composition & Sharing | Pending |
| UI-07 | Phase 5: DX, SPA Composition & Sharing | Pending |
| UI-08 | Phase 2: State Foundation, Messaging & Popup Shell | Pending |
| HLP-01 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-02 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-03 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-04 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-05 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-06 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-07 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-08 | Phase 4: Helpers & LLM Integration | Pending |
| HLP-09 | Phase 4: Helpers & LLM Integration | Pending |
| DX-01 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DX-02 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DX-03 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DX-04 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DX-05 | Phase 5: DX, SPA Composition & Sharing | Pending |
| SHR-01 | Phase 5: DX, SPA Composition & Sharing | Pending |
| SHR-02 | Phase 5: DX, SPA Composition & Sharing | Pending |
| SHR-03 | Phase 6: Distribution & Acceptance | Pending |
| SHR-04 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DIST-01 | Phase 6: Distribution & Acceptance | Pending |
| DIST-02 | Phase 5: DX, SPA Composition & Sharing | Pending |
| DIST-03 | Phase 6: Distribution & Acceptance | Pending |
| ACC-01 | Phase 6: Distribution & Acceptance | Pending |
| ACC-02 | Phase 6: Distribution & Acceptance | Pending |
| ACC-03 | Phase 6: Distribution & Acceptance | Pending |
| ACC-04 | Phase 6: Distribution & Acceptance | Pending |
| ACC-05 | Phase 6: Distribution & Acceptance | Pending |
| ACC-06 | Phase 6: Distribution & Acceptance | Pending |
| ACC-07 | Phase 6: Distribution & Acceptance | Pending |

**Coverage:**
- v1 requirements: 63 total (corrected from previously stated 53; full enumeration above)
- Mapped to phases: 63 (100%)
- Unmapped: 0

**Per-phase counts:**
- Phase 1 (Foundation Spike & Engine Skeleton): 8 requirements — ENG-01, ENG-02, ENG-03, ENG-05, BLD-01, BLD-02, BLD-05, MAN-01
- Phase 2 (State Foundation, Messaging & Popup Shell): 10 requirements — ENG-04, ENG-06, BLD-03, BLD-04, MAN-03, MAN-04, UI-01, UI-03, UI-04, UI-08
- Phase 3 (Tweak System): 10 requirements — MAN-02, TWK-01, TWK-02, TWK-03, TWK-04, TWK-05, TWK-06, TWK-07, UI-02, UI-05
- Phase 4 (Helpers & LLM Integration): 9 requirements — HLP-01, HLP-02, HLP-03, HLP-04, HLP-05, HLP-06, HLP-07, HLP-08, HLP-09
- Phase 5 (DX, SPA Composition & Sharing): 15 requirements — ENG-07, ENG-08, ENG-09, TWK-08, UI-06, UI-07, DX-01, DX-02, DX-03, DX-04, DX-05, SHR-01, SHR-02, SHR-04, DIST-02
- Phase 6 (Distribution & Acceptance): 11 requirements — BLD-06, SHR-03, DIST-01, DIST-03, ACC-01, ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07

---
*Requirements defined: 2026-04-25*
*Last updated: 2026-04-25 — traceability filled by roadmapper, full 63-requirement coverage validated*
