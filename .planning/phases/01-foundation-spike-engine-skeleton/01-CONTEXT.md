# Phase 1: Foundation Spike & Engine Skeleton — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Эмпирически снять самые рискованные MV3-неизвестности и собрать загружаемый скелет расширения, на котором поедут все остальные фазы. В конце фазы:

- Расширение грузится в Chrome через "load unpacked".
- Один smoke-эксперимент (`experiments/andrew/smoke/`) красит ya.ru розовым при включении и чисто откатывает при выключении.
- Билд-пайплайн обнаруживает эксперименты через `import.meta.glob`, валидирует манифесты Zod-ом, падает с понятной ошибкой на невалидном.
- CI lint блокирует `eval`, `new Function`, `import("https://...")`.
- Service worker не держит in-memory state — рестарт SW не ломает apply/cleanup.
- Документ `docs/spike/MV3-FOUNDATION.md` фиксирует verified-vs-broken по 5 пунктам: WXT vs CRXJS, content-script HMR, dynamic import cache-busting, SW idle termination, isolated/MAIN world routing.

**В скоупе фазы (8 требований):** ENG-01, ENG-02, ENG-03, ENG-05, BLD-01, BLD-02, BLD-05, MAN-01.

**Не в скоупе:** твики (Phase 3), хелперы `llm()`/`fetchPage()` (Phase 4), hot-reload (Phase 5), фактический popup UI (Phase 2 — здесь только bare-bones toggle, без shadcn).

</domain>

<decisions>
## Implementation Decisions

### Stack & Tooling

- **D-01:** Фреймворк — **WXT** (`~0.20.x`). Wraps Vite, file-based entrypoints, лучший доступный content-script HMR, активно поддерживается. Закрывает reconciliation между ARCHITECTURE.md (CRXJS) и STACK.md (WXT) — спайк должен подтвердить что HMR-контракт WXT матчит ожидания из ARCHITECTURE.md, иначе скорректируем design в Phase 5.
- **D-02:** Языки — **TypeScript 5.6+** для всего (расширение, SDK-пакет, эксперименты). Эксперименты дизайнеры тоже пишут на TS — через `experiment-sdk` импортируют типы и Cursor подсказывает.
- **D-03:** Валидация — **Zod `~3.23+`** для манифестов экспериментов и любых runtime-границ.
- **D-04:** Состояние popup'а — **Zustand `~5.x`** (минимально, появится в Phase 2; здесь не используем).
- **D-05:** UI-кит — **shadcn/ui (latest CLI) + Tailwind CSS v4 + React 19**. В Phase 1 ставим setup, но рендерим только bare popup-toggle для smoke. Полноценный UI — Phase 2/3.
- **D-06:** Lint + format — **Biome** (один бинарь, ~10x быстрее ESLint+Prettier). Кастомное правило для CSP (см. ниже).
- **D-07:** Тесты — **Vitest** для unit'ов в Phase 1 (минимум: Zod-схема манифеста, URL-scope matcher). Playwright появится позже.
- **D-08:** Менеджер пакетов — **pnpm workspaces**. Никаких Nx/Turborepo — overkill для команды из ~3 человек.

**Verification before lockfile commit:** все версии в STACK.md помечены как best-guess. Перед `pnpm install` запустить `npm view <pkg> version` для wxt, react, tailwindcss, shadcn, zod, zustand, vitest, biome — и зафиксировать актуальные.

### Repository Layout (с первого дня)

- **D-09:** Монорепо-layout:
  ```
  /
  ├── apps/
  │   └── extension/                     # WXT-проект, manifest, popup, content, background
  │       ├── src/
  │       │   ├── background/main.ts
  │       │   ├── content/engine.ts
  │       │   ├── popup/                 # bare toggle в Phase 1
  │       │   └── shared/                # типизированные адаптеры storage/messaging
  │       ├── wxt.config.ts
  │       └── package.json
  ├── packages/
  │   └── experiment-sdk/                # типы для авторов экспериментов
  │       ├── src/index.ts               # ExperimentManifest, ApplyArgs, Helpers
  │       └── package.json
  ├── experiments/
  │   └── andrew/
  │       └── smoke/
  │           ├── manifest.json
  │           └── experiment.ts
  ├── docs/
  │   └── spike/MV3-FOUNDATION.md
  ├── tools/
  │   └── build-experiments.ts           # Vite plugin: глоб + Zod + chunk-эмит
  ├── pnpm-workspace.yaml
  ├── package.json
  └── biome.json
  ```
- **D-10:** Splitting `experiment-sdk` сразу — research отдельно флагует, что сделать это позже дорого. Phase 1 пакет минимален (только типы, нулевой runtime).
- **D-11:** Папка `experiments/` лежит в корне репо (не внутри `apps/extension/`). Это отдельная рабочая зона для дизайнеров — они туда коммитят свои папки, и build-time discovery её сканирует.

### Engine Architecture

- **D-12:** **Service worker stateless.** Никаких `let cache = ...` в module scope. Всё состояние — `chrome.storage.local`. Это проверяется в spike: остановить SW через `chrome://serviceworker-internals`, потом дёрнуть событие — apply/cleanup должны отработать. (закрывает ENG-02 + Pitfall 1)
- **D-13:** **Two-world routing — декларативно через манифест.** В манифесте эксперимента поле `world: 'isolated' | 'main'` (default `'isolated'`). В `manifest.json` плагина две записи `content_scripts` с `world: "ISOLATED"` и `world: "MAIN"`, каждая грузит свой entry-content-script. Engine в каждом мире фильтрует registry по `world` и грузит только свои эксперименты. Без runtime-`chrome.scripting.executeScript`-инжекций — они усложняют CSP и дебаг. Bridge между мирами в Phase 1 не делаем (нужен только когда эксперимент явно живёт в обоих — это отложено до реального кейса). (закрывает ENG-03)
- **D-14:** **Error isolation.** Engine оборачивает каждый `apply()` и `cleanup()` в try/catch. Ошибка одного эксперимента логируется (в Phase 1 — в console + chrome.storage.local last-error), не валит остальные. Auto-disable после N ошибок — Phase 2 (ENG-06). (закрывает ENG-05)
- **D-15:** **Engine contract** (фиксируется в `experiment-sdk`):
  ```ts
  type ApplyArgs = {
    tweaks: Record<string, unknown>;   // в Phase 1 всегда {}
    helpers: Helpers;                   // в Phase 1 минимальный {log}
    currentURL: string;
    log: (msg: string, ...args: unknown[]) => void;
    signal: AbortSignal;                // для async-операций
  };
  type ApplyFn = (args: ApplyArgs) => CleanupFn | Promise<CleanupFn>;
  type CleanupFn = () => void | Promise<void>;
  ```
  Полная схема `Helpers` (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`, `llm`, `fetchPage`) — Phase 4. В Phase 1 эксперимент сам делает DOM-операции и возвращает cleanup-замыкание.

### Manifest Schema (v1)

- **D-16:** Zod-схема для `experiments/<author>/<id>/manifest.json`:
  ```ts
  const ExperimentManifest = z.object({
    id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),  // ULID
    name: z.string().min(1),
    author: z.string().min(1),                          // должен совпадать с папкой
    description: z.string().min(1).max(280),            // короткая; полный description.md — Phase 5
    scope: z.object({
      match: z.array(z.string()).min(1),                // Chrome match-patterns
      regex: z.array(z.string()).optional(),            // regex fallback — реализация в Phase 3 (MAN-02)
    }),
    world: z.enum(['isolated', 'main']).default('isolated'),
    tweaks: z.array(z.unknown()).default([]),           // полная схема — Phase 3 (TWK-01)
  });
  ```
  (закрывает MAN-01)
- **D-17:** **ULID авто-генерится при первом билде.** Если в `manifest.json` нет поля `id` или оно пустое — build-time tool генерит ULID, дописывает в файл, печатает: "Wrote new id to {path} — please commit". Дальше id не трогаем никогда (rename папки не ломает state — это правило закрепится в Phase 2 через MAN-03). Фиксированный ID = stable references для presets/storage.
- **D-18:** **Author совпадает с папкой.** Build-time валидация: `experiments/<author>/<id>/manifest.json` — если manifest.author ≠ путь, сборка падает. Это чтобы не было разъезда автора и владельца папки.
- **D-19:** Поле `description` — короткая строка в манифесте (1-280 символов). Полноценный `description.md` (auto-generated by Cursor) — DX-03 в Phase 5; сейчас не делаем.

### Build Pipeline

- **D-20:** Discovery — Vite-плагин (или WXT-hook) использует `import.meta.glob('experiments/*/*/manifest.json', {eager: true})` для манифестов и `import.meta.glob('experiments/*/*/experiment.ts')` для модулей. Каждый эксперимент компилится в отдельный chunk — content script грузит только нужные через dynamic `import()` от extension origin. (закрывает BLD-01, BLD-04 заранее)
- **D-21:** Manifest-валидация — Vite plugin проходит каждый manifest через Zod на этапе сборки. Невалидный манифест → билд падает с указанием файла, поля, и читаемой ошибкой. (закрывает BLD-02)
- **D-22:** В Phase 1 `dist/registry.json` ещё **не нужен** (это требование BLD-03 в Phase 2). Здесь registry — in-memory у content script'а через `import.meta.glob({eager:true})`. Это упрощение для скелета.

### CI / Linting

- **D-23:** Biome + кастомная проверка — простой regex-grep по `src/` и `experiments/` на запрещённые паттерны: `\beval\s*\(`, `\bnew\s+Function\s*\(`, `import\s*\(\s*['"]https?://`. Реализуется как `scripts/check-csp.ts`, вызывается из `pnpm lint` и pre-commit (`lefthook` или `husky` — выберу проще, скорее всего `lefthook`). (закрывает BLD-05)
- **D-24:** Pre-commit hook + GitHub Actions workflow `.github/workflows/ci.yml` — оба запускают `pnpm lint` + `pnpm typecheck` + `pnpm test`. CI обязательный для merge.

### Spike Approach & Artifacts

- **D-25:** **Spike перерастает в foundation.** То, что напишем для валидации, и есть скелет. Никакого throwaway-прототипа.
- **D-26:** Документ-итог — `docs/spike/MV3-FOUNDATION.md` с разделами:
  1. WXT vs CRXJS reconciliation — что используем, почему, какие WXT-абстракции эквивалентны паттернам ARCHITECTURE.md.
  2. Content-script HMR — verified-vs-broken (точно ли работает re-apply без full reload? какая задержка?).
  3. Dynamic import cache-busting — какие версии URL/query-параметры нужны, чтобы content script подхватывал новый chunk без расширения reload.
  4. SW idle termination — измеренное время idle до kill в текущей версии Chrome; что происходит с in-flight `fetch` при kill.
  5. Two-world routing — подтверждено что декларативный подход работает; пример isolated-only и main-only experiments оба грузятся.
- **D-27:** **Smoke-проверка SW lifecycle.** Чек-лист в spike-доке: открыть `chrome://serviceworker-internals`, нажать "stop" на SW расширения, переключить smoke-experiment в popup'е — должен отработать apply/cleanup корректно. Это закрывает success criterion #5.

### Smoke Experiment

- **D-28:** **Чистый минимум** (выбрано продуктово). `experiments/andrew/smoke/`:
  - `manifest.json`: `id` (ULID), `name: "Smoke pink"`, `author: "andrew"`, `description: "Turns ya.ru pink to verify foundation"`, `scope.match: ["*://*.ya.ru/*", "*://ya.ru/*"]`, `world: "isolated"`, `tweaks: []`.
  - `experiment.ts`:
    ```ts
    import type { ApplyFn } from '@platform/experiment-sdk';
    export const apply: ApplyFn = ({ log }) => {
      const style = document.createElement('style');
      style.dataset.expId = 'smoke';
      style.textContent = 'body { background: pink !important; }';
      document.head.append(style);
      log('smoke applied');
      return () => { style.remove(); log('smoke cleaned up'); };
    };
    ```
  - Без твиков, без LLM, без `injectStyle`-хелпера (хелперы — Phase 4). Эксперимент сам делает DOM и возвращает cleanup-замыкание.
- **D-29:** Popup в Phase 1 — bare-bones list с одним toggle'ом для smoke. Без shadcn-карточек, без группировки по авторам, без статус-бейджей (всё это — Phase 2). Goal: визуально подтвердить что enable/disable работает.

### Claude's Discretion

Все имплементационные мелочи (имена файлов внутри `apps/extension/src/`, структура `wxt.config.ts`, точные версии lockfile'а после `npm view`-проверки, расположение CSS-файлов, выбор pre-commit hook менеджера, формат logger'а в `log()`) — на моё усмотрение в плане и исполнении. Если что-то отклонится от вышеперечисленного — отмечу в PLAN.md и DEVIATIONS.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before работой над фазой.**

### Project foundation
- `.planning/PROJECT.md` — vision, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — все 63 v1-требования; для Phase 1 релевантны 8 (ENG-01, ENG-02, ENG-03, ENG-05, BLD-01, BLD-02, BLD-05, MAN-01)
- `.planning/ROADMAP.md` — phase boundary, success criteria, dependencies, requirements mapping

### Research outputs
- `.planning/research/SUMMARY.md` — executive summary, confidence assessment, gaps
- `.planning/research/STACK.md` — technology choices, version targets (`~` помечены как best-guess; verify before lockfile)
- `.planning/research/ARCHITECTURE.md` — Level 0-5 build order, component breakdown, anti-patterns
- `.planning/research/PITFALLS.md` — критические ловушки MV3 (особенно Pitfalls 1, 2, 3, 5 — все четыре прямо адресуются Phase 1)
- `.planning/research/FEATURES.md` — feature landscape (для Phase 1 не критично, но полезно для понимания "куда едем")

### External docs (verify в spike)
- WXT documentation — `wxt.dev` — framework primitives, content-script HMR contract; **обязательно читать актуальные доки во время spike** (training data может отставать)
- Chrome Extension MV3 documentation — `developer.chrome.com/docs/extensions/mv3` — SW lifecycle, scripting API, CSP, world: MAIN, host_permissions, content_scripts, chrome.storage.local quotas
- shadcn/ui — `ui.shadcn.com` — для Phase 1 только установка CLI; полноценное использование — Phase 2+
- Tailwind CSS v4 — `tailwindcss.com` — Vite plugin setup
- Biome docs — `biomejs.dev` — конфиг и правила

### Конкретные адресные правила из PITFALLS.md (must-read)
- Pitfall 1 (SW lifecycle) — закрывается D-12, success criterion #5
- Pitfall 2 (CSP — eval/new Function/remote import) — закрывается D-23, success criterion #4
- Pitfall 3 (execution world routing) — закрывается D-13
- Pitfall 5 (Tailwind preflight) — в Phase 1 не загрязняем host page (popup в его собственном document'е); полная защита Shadow DOM — Phase 3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

Нет — репозиторий пуст (на момент 2026-04-25 в проекте только `.planning/`, `.git/`, `.claude/` и `temp`). Phase 1 создаёт всю кодовую структуру с нуля.

### Established Patterns

Никаких существующих паттернов в коде — design contracts фиксируются именно в этой фазе. Это и есть foundation: после Phase 1 паттерны (typed messaging, storage adapter, engine contract) становятся обязательными для всех последующих фаз.

### Integration Points

- `experiments/<author>/<id>/` — точка интеграции для дизайнеров (создаётся в Phase 1, заселяется в Phase 6 акцептансом).
- `apps/extension/src/content/engine.ts` — engine contract; Phase 2 расширяет (URL-scope matching, error policies); Phase 3 добавляет tweak round-trip; Phase 4 — helpers; Phase 5 — SPA navigation, multi-experiment ordering.
- `packages/experiment-sdk/src/index.ts` — публичный SDK для авторов; Phase 2 расширяет типы (`Helpers`, `ExperimentManifest` финальный); Phase 4 — `Helpers.llm`, `Helpers.fetchPage`.
- `tools/build-experiments.ts` — Vite plugin; Phase 2 добавляет emit `dist/registry.json` (BLD-03), code-split chunks (BLD-04).

</code_context>

<specifics>
## Specific Ideas

- **Площадка для smoke — ya.ru.** Не example.com, не фиктивный сайт. Research-flag: ya.ru — основная боевая площадка для всего проекта (поисковая выдача), и host_permissions нужно тестировать именно там. Используем match-patterns `*://*.ya.ru/*` и `*://ya.ru/*` (yandex.com и yandex.ru — не в скоупе Phase 1).
- **Smoke принадлежит andrew.** `experiments/andrew/smoke/` — это твоя папка как первого дизайнера/onboarder'а. designer1/designer2/designer3 (по PROJECT.md acceptance scenario) появятся в Phase 6. Здесь только andrew, чтобы не имитировать team раньше времени.
- **Версия Chrome для верификации spike** — последняя стабильная на момент Phase 1 execution (Chrome ~133+, апрель 2026). SW idle ~30s — это nominal; spike должен измерить фактическое значение и записать в `MV3-FOUNDATION.md`.

</specifics>

<deferred>
## Deferred Ideas

Не теряем — но в эту фазу не идут:

- **Auto-tracked helpers** (`injectStyle`, `injectNode`, `waitFor`, `onUrlChange`) → Phase 4 (HLP-08). В Phase 1 smoke сам пишет DOM-код.
- **Tweak движок** (auto-render shadcn-controls, Zod-validation values) → Phase 3 (TWK-01..07).
- **Полноценный popup** (группировка по авторам, статусы, фильтр по URL, drag-and-drop ordering) → Phase 2 + Phase 5.
- **`dist/registry.json` artifact + code-split chunks per experiment** → Phase 2 (BLD-03, BLD-04).
- **Stable ULID as separate from path** (rename папки не теряет state) → Phase 2 (MAN-03). В Phase 1 ULID уже фиксирован, но storage-keying появится в Phase 2.
- **Auto-disable после N ошибок** → Phase 2 (ENG-06).
- **Hot-reload dev mode** (file-watcher → RE_APPLY_EXPERIMENT) → Phase 5 (DX-01).
- **`description.md` auto-generated by Cursor** → Phase 5 (DX-03). В Phase 1 — короткая `description` строка в манифесте.
- **Two-world bridge** (CustomEvent / window-shared объект между isolated и main экспериментами одного эксперимента) → откладываем до реального кейса (не v1 без явного запроса).
- **Yandex Browser smoke-test** → Phase 6 (DIST-03). В Phase 1 валидируем только Chrome stable.
- **`.crx` packaging + GitHub Releases workflow** → Phase 6 (DIST-01).

</deferred>

---

*Phase: 01-foundation-spike-engine-skeleton*
*Context gathered: 2026-04-25*
