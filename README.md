# Crust

Crust is a local browser extension for running design experiments on real websites. It is meant to be used with AI coding tools like Cursor, Codex, and Claude Code: you describe the experiment, the agent edits files in `experiments/<your-name>/<experiment-name>/`, and Crust lets you turn that experiment on in the browser popup.

You do not need to understand the whole codebase to start. The usual workflow is: install once, keep dev mode running, ask your coding agent to create an experiment from your description, then test it on the target page.

## Quick Start For AI Coding Tools

First, get the project onto your computer.

Pick a place where the project folder should live. If you are not sure, use `Desktop` so you can easily find it in Finder. Open Terminal and run:

```sh
cd ~/Desktop
git clone https://github.com/andreashxc/crust-design-plugin.git
cd crust-design-plugin
```

This creates a new folder at `Desktop/crust-design-plugin`. That folder is the Crust project. If you prefer a different location, open that folder in Finder, drag it into Terminal after typing `cd `, press Enter, and then run the `git clone` command.

If `git` is missing, install GitHub Desktop or Xcode Command Line Tools first, then try again.

After that, open the `crust-design-plugin` folder in Cursor, Codex, or Claude Code and paste this prompt:

```text
Set up this Crust repo for local experiment development.

Run the install/dev commands, explain any errors in plain language, and do not change product code unless setup requires it.

Commands:
corepack enable
corepack pnpm install
corepack pnpm dev
```

When dev mode is running, load the extension:

1. Open `chrome://extensions` in Chrome or `browser://extensions` in Yandex Browser.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `crust-extension` from the repo root.
5. Open `https://ya.ru/`.
6. Open the Crust toolbar popup.

Keep `corepack pnpm dev` running while you work. Crust watches `experiments/**`, refreshes the dev registry, and reapplies enabled experiments without a full extension reload.

## Create An Experiment

Describe the experiment in normal language. Focus on what should happen, where it should happen, and what the user should see or do. You do not need to invent an experiment ID, folder name, display name, or implementation plan. The coding agent should choose those and explain what it did.

If you have a local site design context file, put it in one of these places before asking the agent:

```text
design-context/<site>/DESIGN.md
.crust/design-context/<site>/DESIGN.md
```

Example: `design-context/ya.ru/DESIGN.md`. These files are ignored by git by default. They can contain notes about the site's visual style, DOM structure, responsive behavior, and extension pitfalls, so the agent has better context before it writes the experiment.

To check that Crust finds it, ask the agent to run:

```sh
corepack pnpm design-context --url https://ya.ru/
```

Paste a prompt like this:

```text
Create a Crust experiment.

What I want:
<describe the experiment behavior and visual result>

Where it should work:
<list the page URLs or URL patterns>

How it should work:
<describe when it appears, what it changes, what should happen on click/hover/scroll, and any states or variants>

Please choose the author folder, experiment folder name, display name, manifest scope, file structure, and reasonable implementation details yourself.
Ask only product or design questions that block the result.

If a matching local DESIGN.md site context exists, read its summary first and use it when choosing layout, typography, colors, DOM anchors, and extension-safe implementation details.
Add tweak controls if they would help compare variants in the popup.
After implementation, run the relevant checks and tell me exactly what to reload or test in the browser.
```

Example prompt:

```text
Create a Crust experiment.

What I want:
On ya.ru, show a compact floating promo card near the search box. It should look native to the page, not like a developer demo.

Where it should work:
https://ya.ru/

How it should work:
The card appears after the page loads. It has a short headline, a small close button, and a CTA button. Closing it hides it until the experiment is toggled off and on again. Add tweaks for headline text, accent color, and card position.

Please choose the author folder, experiment folder name, display name, manifest scope, file structure, and reasonable implementation details yourself.
Ask only product or design questions that block the result.

If a matching local DESIGN.md site context exists, read its summary first and use it when choosing layout, typography, colors, DOM anchors, and extension-safe implementation details.
Add tweak controls if they would help compare variants in the popup.
After implementation, run checks and tell me what to test.
```

The agent will usually create:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  analysis.md
  description.md
  presets/
```

For anything more complex than a tiny one-file tweak, ask the agent to keep the implementation self-contained inside that folder. Extra files like `dom.ts`, `renderer.ts`, `styles.ts`, `copy.ts`, or `prompt.ts` are encouraged. Core extension files should only change when the experiment needs a genuinely reusable platform capability, such as a new browser API helper or host permission.

Fresh public forks include only examples in `experiments/examples/**`. Your own folders like `experiments/andrew/**` are local by default and ignored by git, so private experiments are not accidentally published.

If you want to change an existing experiment later, say that explicitly and name it, for example: `Edit experiments/andrew/search-banner: change the CTA copy and add a position tweak.`

Then test in the browser:

1. Open a page that matches the experiment scope.
2. Open the Crust popup.
3. Enable the experiment.
4. Adjust tweaks if the experiment has them.
5. If you added or removed experiment folders while the popup was already open, click the popup refresh icon.

## Use Crust Hummer

Crust Hummer is the repo-side AI workflow for design/product UI work on real websites. Crust stays the browser runtime: it loads and toggles experiments. Hummer is the Codex/AI workflow that analyzes a task and URL, creates or updates experiment files, writes `analysis.md` and `description.md`, adds tweakable variants, and leaves you to enable the result in the Crust popup.

Use Hummer when you want the agent to reason like a product designer, compare conservative/balanced/exploratory directions, and implement the recommended prototype as a Crust experiment.

Hummer is intentionally lean: one agent normalizes the task, gathers page evidence, compares three branches, recommends one branch, implements it as a Crust experiment, writes `analysis.md` and `description.md`, and runs typecheck/build QA. It should not clone references, create a separate agent app, add popup authoring, run a companion server, add Figma integration, or make broad core changes unless the task explicitly needs a reusable platform capability.

Prompt example:

```text
Use Crust Hummer.

Task:
Improve the pricing hero: the value proposition is unclear and CTA hierarchy is weak.

URL:
https://example.com/pricing

Business goal:
Increase trial starts.

Design freedom:
balanced

References:
none

Output:
Create a Crust experiment with 3 tweakable variants and recommend one.
```

The starter command for arbitrary URLs is:

```sh
corepack pnpm create-experiment <author> <folder> "Display Name" --url <target-url> --scope path --template hummer
```

Scope modes:

- `path`: target the exact path, ignoring query and hash.
- `origin`: target the whole origin.
- `host`: target the origin and wildcard subdomains.

References are opt-in. By default, Hummer uses no external references. If you want the agent to inspect inspiration or competitor pages, say it explicitly:

```text
References:
provided URLs allowed:
- https://reference.example/pricing
- https://reference.example/signup
```

If your AI environment has an MCP connector or reference tool such as Lazyweb, you can allow it explicitly:

```text
References:
MCP references allowed
Lazyweb allowed
```

Hummer should extract reusable patterns only. It should not copy exact layouts, brand assets, exact text, or execute remote code from references.

After adding an experiment for a new domain, rebuild and reload the extension because Chrome permissions are generated from experiment scopes during dev/build. More detail: `docs/HUMMER.md`.

## Save Tweak Presets

If you find useful tweak values in the popup, ask your coding agent:

```text
Save the current tweak values as a Crust preset for experiments/<author>/<folder>.
Preset name: <preset-name>
Values: <paste JSON from popup or describe the values>
```

Or run:

```sh
corepack pnpm save-preset <author>/<folder> <preset-name> '<json-values>'
```

## Share Experiments

By default, personal experiments are ignored by git. That is intentional.

Do not commit personal or client experiments into the Crust plugin repository. Keep the plugin repo clean and use a separate private GitHub repository, private gist, secure archive, or team file share for experiment exchange.

Recommended teammate flow:

```text
Package this Crust experiment for sharing outside the plugin repo:
experiments/<author>/<folder>

Create a clean copy that includes manifest.json, experiment.ts, analysis.md, description.md, presets/, and any local helper files from that experiment folder. Do not commit it into the Crust plugin repository.
```

The teammate should copy that folder into their own local Crust checkout under `experiments/<their-name>/<folder>/`, then run `corepack pnpm dev` or rebuild the extension. If the experiment targets a new domain, they need to reload the extension because Chrome permissions are generated from experiment scopes during dev/build.

Only curated public examples should be intentionally added under `experiments/examples/**`.

## Release Install

Use this when you want to test Crust as a packaged extension without running dev mode.

GitHub Releases can contain:

- `crust-chrome-mv3-unpacked.zip`: the useful file for manual `Load unpacked` installation.
- `platformextension-0.0.0-chrome.zip`: the WXT-generated package artifact. It is mostly build output, not the friendliest file for manual testing.

Recommended manual install:

1. Download `crust-chrome-mv3-unpacked.zip`.
2. Unzip it locally.
3. Open `chrome://extensions` or `browser://extensions`.
4. Enable Developer mode.
5. Click `Load unpacked`.
6. Select the unzipped `chrome-mv3` folder.

Crust does not currently publish a signed `.crx`; use the unpacked zip for sideload testing.

## License And Brand

Crust source code is distributed under the GNU General Public License v3.0 only. You can use, study, modify, and share the code under the terms in `LICENSE`, but distributed modified versions must keep the same GPLv3 freedoms and source availability.

The `Crust` name, logo, and project identity are brand assets of this project. Forks and modified builds should not present themselves as the official Crust project unless they are released by the project owner.

## Troubleshooting

- Popup says no experiments yet: run `corepack pnpm dev` or `corepack pnpm build`.
- Experiment is hidden: open a page matching `manifest.json` `scope.match` or `scope.regex`.
- New folder is missing: keep dev mode running and click the popup refresh icon.
- Experiment does not change the page: ask your coding agent to inspect the browser console, Crust errors page, and the experiment `apply` function.
- LLM experiment warns about a missing key: open Crust options and add your provider API key.

---

# Crust Onboarding На Русском

Crust это локальное расширение для браузера, чтобы запускать дизайн-эксперименты на настоящих сайтах. Оно рассчитано не только на разработчиков, а на работу через AI-инструменты: Cursor, Codex, Claude Code. Ты описываешь, что хочешь поменять на странице, AI-агент редактирует файлы эксперимента, а ты включаешь эксперимент в popup расширения.

Тебе не нужно сразу понимать весь проект. Базовый сценарий такой: один раз настроить проект, держать dev mode включенным, просить AI-агента создать эксперимент по твоему описанию, потом проверять результат в браузере.

## Быстрый Старт Для Cursor, Codex, Claude Code

Сначала нужно скачать проект на компьютер.

Выбери место, где будет лежать папка проекта. Если не уверен, используй `Desktop`, чтобы папку было легко найти через Finder. Открой Terminal и запусти:

```sh
cd ~/Desktop
git clone https://github.com/andreashxc/crust-design-plugin.git
cd crust-design-plugin
```

После этого на рабочем столе появится папка `crust-design-plugin`. Это и есть проект Crust. Если хочешь положить проект в другое место, открой нужную папку в Finder, напиши в Terminal `cd `, перетащи папку в Terminal, нажми Enter, а потом запусти команду `git clone`.

Если команда `git` не работает, сначала установи GitHub Desktop или Xcode Command Line Tools, потом повтори команды.

После этого открой папку `crust-design-plugin` в Cursor, Codex или Claude Code и вставь AI-агенту такой запрос:

```text
Подготовь этот Crust repo для локальной разработки экспериментов.

Запусти команды установки и dev mode. Если будут ошибки, объясни их простым языком. Не меняй продуктовый код, если это не нужно для установки.

Команды:
corepack enable
corepack pnpm install
corepack pnpm dev
```

Когда dev mode запущен, подключи расширение:

1. Открой `chrome://extensions` в Chrome или `browser://extensions` в Яндекс Браузере.
2. Включи Developer mode.
3. Нажми `Load unpacked`.
4. Выбери папку `crust-extension` в корне репозитория.
5. Открой `https://ya.ru/`.
6. Открой popup Crust в toolbar браузера.

Пока работаешь, оставляй `corepack pnpm dev` запущенным. Crust следит за `experiments/**`, обновляет список экспериментов и заново применяет включенные эксперименты без полной перезагрузки расширения.

## Создать Эксперимент

Опиши эксперимент обычным языком. Сфокусируйся на том, что должно произойти, на каких страницах и что пользователь должен увидеть или сделать. Не нужно придумывать ID, имя папки, красивое название или технический план. AI-агент должен сам выбрать это и объяснить, что сделал.

Если у тебя есть локальный файл с дизайн-контекстом сайта, положи его в одно из этих мест до запроса агенту:

```text
design-context/<site>/DESIGN.md
.crust/design-context/<site>/DESIGN.md
```

Пример: `design-context/ya.ru/DESIGN.md`. Эти файлы по умолчанию игнорируются git. В них можно хранить заметки про визуальный стиль сайта, DOM-структуру, responsive-поведение и ловушки для браузерного расширения, чтобы AI-агент не угадывал всё с нуля.

Чтобы проверить, что Crust видит файл, попроси агента запустить:

```sh
corepack pnpm design-context --url https://ya.ru/
```

Вставь примерно такой запрос:

```text
Создай Crust experiment.

Что я хочу:
<опиши поведение эксперимента и визуальный результат>

Где это должно работать:
<перечисли URL страниц или паттерны URL>

Как это должно работать:
<опиши когда появляется, что меняет, что происходит при клике/hover/scroll, какие есть состояния или варианты>

Сам выбери author-папку, имя папки эксперимента, display name, manifest scope, структуру файлов и разумные технические детали.
Задавай только продуктовые или дизайн-вопросы, без которых нельзя сделать результат.

Если есть подходящий локальный DESIGN.md site context, сначала прочитай его summary и используй его для layout, typography, colors, DOM anchors и безопасной реализации внутри extension.
Добавь tweak controls, если они помогут сравнивать варианты в popup.
После реализации запусти нужные проверки и скажи, что именно мне перезагрузить или проверить в браузере.
```

Пример запроса:

```text
Создай Crust experiment.

Что я хочу:
На ya.ru покажи компактную floating promo-карточку рядом с поиском. Она должна выглядеть нативно для страницы, не как developer demo.

Где это должно работать:
https://ya.ru/

Как это должно работать:
Карточка появляется после загрузки страницы. В ней короткий заголовок, маленькая кнопка закрытия и CTA-кнопка. Закрытие скрывает карточку до выключения и повторного включения эксперимента. Добавь твики для текста заголовка, accent color и позиции карточки.

Сам выбери author-папку, имя папки эксперимента, display name, manifest scope, структуру файлов и разумные технические детали.
Задавай только продуктовые или дизайн-вопросы, без которых нельзя сделать результат.

Если есть подходящий локальный DESIGN.md site context, сначала прочитай его summary и используй его для layout, typography, colors, DOM anchors и безопасной реализации внутри extension.
Добавь tweak controls, если они помогут сравнивать варианты в popup.
После реализации запусти проверки и скажи, что мне тестировать.
```

Обычно агент создаст:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  analysis.md
  description.md
  presets/
```

Если эксперимент сложнее маленькой правки в одном файле, попроси агента держать реализацию внутри этой папки. Дополнительные файлы вроде `dom.ts`, `renderer.ts`, `styles.ts`, `copy.ts` или `prompt.ts` это нормально и даже желательно. Core-файлы расширения стоит менять только когда эксперименту правда нужна переиспользуемая платформенная возможность: новый browser API helper, host permission или другой общий boundary.

В публичном GitHub лежат только примеры в `experiments/examples/**`. Твои личные папки вроде `experiments/andrew/**` по умолчанию локальные и игнорируются git, чтобы случайно не запушить приватные эксперименты.

Если позже нужно изменить существующий эксперимент, скажи это явно и назови его, например: `Измени experiments/andrew/search-banner: поменяй текст CTA и добавь твик позиции.`

Потом проверь в браузере:

1. Открой страницу, которая подходит под scope эксперимента.
2. Открой popup Crust.
3. Включи эксперимент.
4. Если есть твики, покрути настройки.
5. Если добавлял или удалял папки экспериментов при уже открытом popup, нажми refresh в popup.

## Использовать Crust Hummer

Crust Hummer это repo-side AI workflow для дизайн- и продуктовых UI-задач на реальных сайтах. Crust остается runtime-слоем в браузере: он загружает и включает эксперименты. Hummer это workflow для Codex/AI-агента: он анализирует задачу и URL, создает или обновляет файлы эксперимента, пишет `analysis.md` и `description.md`, добавляет tweakable-варианты и оставляет тебе включить результат в popup Crust.

Используй Hummer, когда хочешь, чтобы агент думал как продуктовый дизайнер, сравнил conservative/balanced/exploratory направления и реализовал рекомендованный прототип как Crust experiment.

Hummer намеренно остается легким: один агент нормализует задачу, собирает page evidence, сравнивает три ветки, рекомендует одну, реализует ее как Crust experiment, пишет `analysis.md` и `description.md`, затем запускает typecheck/build QA. Он не должен клонировать референсы, создавать отдельное agent app, добавлять popup authoring, запускать companion server, добавлять Figma integration или делать широкие core changes, если задаче явно не нужна переиспользуемая platform capability.

Пример запроса:

```text
Use Crust Hummer.

Task:
Improve the pricing hero: the value proposition is unclear and CTA hierarchy is weak.

URL:
https://example.com/pricing

Business goal:
Increase trial starts.

Design freedom:
balanced

References:
none

Output:
Create a Crust experiment with 3 tweakable variants and recommend one.
```

Команда для starter-эксперимента под любой URL:

```sh
corepack pnpm create-experiment <author> <folder> "Display Name" --url <target-url> --scope path --template hummer
```

Режимы scope:

- `path`: только конкретный path, без query и hash.
- `origin`: весь origin.
- `host`: origin и wildcard subdomains.

Референсы включаются только явно. По умолчанию Hummer не использует внешние референсы. Если хочешь, чтобы агент посмотрел inspiration или страницы конкурентов, напиши это прямо:

```text
References:
provided URLs allowed:
- https://reference.example/pricing
- https://reference.example/signup
```

Если в твоей AI-среде есть MCP connector или reference tool вроде Lazyweb, разреши его явно:

```text
References:
MCP references allowed
Lazyweb allowed
```

Hummer должен извлекать только переиспользуемые паттерны. Он не должен копировать точные layout, brand assets, точный текст или исполнять remote code из референсов.

После добавления эксперимента под новый домен пересобери и перезагрузи расширение, потому что Chrome permissions генерируются из scope экспериментов во время dev/build. Подробнее: `docs/HUMMER.md`.

## Сохранить Preset Твиков

Если в popup получились хорошие значения твиков, попроси AI-агента:

```text
Сохрани текущие tweak values как Crust preset для experiments/<author>/<folder>.
Preset name: <название-пресета>
Values: <вставь JSON из popup или опиши значения>
```

Или запусти:

```sh
corepack pnpm save-preset <author>/<folder> <preset-name> '<json-values>'
```

## Поделиться Экспериментом

Личные эксперименты по умолчанию игнорируются git. Это специально.

Не коммить личные или клиентские эксперименты в репозиторий плагина Crust. Держи репозиторий плагина чистым, а для обмена используй отдельный приватный GitHub-репозиторий, private gist, защищенный архив или командное файловое хранилище.

Рекомендованный сценарий для обмена с коллегой:

```text
Упакуй этот Crust experiment для передачи вне репозитория плагина:
experiments/<author>/<folder>

Сделай чистую копию, в которую входят manifest.json, experiment.ts, analysis.md, description.md, presets/ и все локальные helper-файлы из папки эксперимента. Не коммить это в репозиторий Crust plugin.
```

Коллега должен скопировать эту папку в свой локальный Crust checkout как `experiments/<его-имя>/<folder>/`, затем запустить `corepack pnpm dev` или пересобрать расширение. Если эксперимент под новый домен, расширение нужно перезагрузить, потому что Chrome permissions генерируются из scope экспериментов во время dev/build.

В git стоит осознанно добавлять только публичные curated examples в `experiments/examples/**`.

## Установка Release Версии

Это нужно, когда хочется проверить Crust как собранное расширение без dev mode.

В GitHub Releases могут быть:

- `crust-chrome-mv3-unpacked.zip`: основной файл для ручной установки через `Load unpacked`.
- `platformextension-0.0.0-chrome.zip`: артефакт, который генерирует WXT. Это скорее build output, а не самый удобный файл для ручного тестирования.

Рекомендованный способ:

1. Скачай `crust-chrome-mv3-unpacked.zip`.
2. Распакуй архив.
3. Открой `chrome://extensions` или `browser://extensions`.
4. Включи Developer mode.
5. Нажми `Load unpacked`.
6. Выбери распакованную папку `chrome-mv3`.

Сейчас Crust не публикует подписанный `.crx`, поэтому для ручного тестирования используй unpacked zip.

## Лицензия И Бренд

Исходный код Crust распространяется под GNU General Public License v3.0 only. Код можно использовать, изучать, изменять и распространять на условиях из `LICENSE`, но распространяемые изменённые версии должны сохранять те же GPLv3-свободы и доступность исходников.

Название `Crust`, логотип и идентичность проекта считаются брендовыми материалами этого проекта. Форки и изменённые сборки не должны выдавать себя за официальный Crust, если они не выпущены владельцем проекта.

## Если Что-то Не Работает

- В popup нет экспериментов: запусти `corepack pnpm dev` или `corepack pnpm build`.
- Эксперимент не показывается: открой страницу, которая совпадает с `scope.match` или `scope.regex` в `manifest.json`.
- Новая папка не появилась: оставь dev mode запущенным и нажми refresh в popup.
- Эксперимент включается, но страница не меняется: попроси AI-агента проверить browser console, Crust errors page и функцию `apply` в эксперименте.
- LLM experiment пишет, что нет ключа: открой настройки Crust и добавь API key нужного провайдера.
