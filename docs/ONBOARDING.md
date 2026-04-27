# Crust Onboarding

Crust is a local browser extension for running small design experiments on real websites. It is meant to be used with AI coding tools like Cursor, Codex, and Claude Code: you describe the experiment, the agent edits files in `experiments/<your-name>/<experiment-name>/`, and Crust lets you turn that experiment on in the browser popup.

You do not need to understand the whole codebase to start. The usual workflow is: install once, keep dev mode running, ask your coding agent to create or edit an experiment, then test it on the target page.

## Quick Start For AI Coding Tools

First, get the project onto your computer.

Pick a place where the project folder should live. If you are not sure, use `Desktop` so you can easily find it in Finder. Open Terminal and run:

```sh
cd ~/Desktop
git clone https://github.com/andreashxc/overlay-plugin.git
cd overlay-plugin
```

This creates a new folder at `Desktop/overlay-plugin`. That folder is the Crust project. If you prefer a different location, open that folder in Finder, drag it into Terminal after typing `cd `, press Enter, and then run the `git clone` command.

If `git` is missing, install GitHub Desktop or Xcode Command Line Tools first, then try again.

After that, open the `overlay-plugin` folder in Cursor, Codex, or Claude Code and paste this prompt:

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
4. Select `apps/extension/.output/chrome-mv3`.
5. Open `https://ya.ru/`.
6. Open the Crust toolbar popup.

Keep `corepack pnpm dev` running while you work. Crust watches `experiments/**`, refreshes the dev registry, and reapplies enabled experiments without a full extension reload.

## Create Or Change An Experiment

Describe the experiment in normal language. You do not need to invent an experiment ID, folder name, or display name. The coding agent should choose those, create the files, and explain what it did. If the agent cannot safely infer something important, it should ask a product question before coding.

Paste a prompt like this:

```text
Create or update a Crust experiment.

What I want:
<describe the experiment behavior and visual result>

Where it should work:
<list the page URLs or URL patterns>

How it should work:
<describe when it appears, what it changes, what should happen on click/hover/scroll, and any states or variants>

Please choose the author folder, experiment folder name, display name, manifest scope, and sensible defaults yourself.
Infer the author folder from my local setup when possible; ask only if you truly cannot infer it.
Create a new experiment by default.
Only update an existing experiment if I explicitly ask you to change that experiment.

Keep it small and reversible. Add tweak controls only when they would help me test variants in the popup.
After editing, run the relevant checks and tell me exactly what to reload or test in the browser.
```

Example prompt:

```text
Create or update a Crust experiment.

What I want:
On ya.ru, show a compact floating promo card near the search box. It should look native to the page, not like a developer demo.

Where it should work:
https://ya.ru/

How it should work:
The card appears after the page loads. It has a short headline, a small close button, and a CTA button. Closing it hides it until the experiment is toggled off and on again. Add tweaks for headline text, accent color, and card position.

Please choose the author folder, experiment folder name, display name, manifest scope, and sensible defaults yourself.
Infer the author folder from my local setup when possible; ask only if you truly cannot infer it.
Create a new experiment by default.
Only update an existing experiment if I explicitly ask you to change that experiment.

Keep it small and reversible. After editing, run checks and tell me what to test.
```

The agent will usually create or edit:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  description.md
  presets/
```

Fresh public forks include only examples in `experiments/examples/**`. Your own folders like `experiments/andrew/**` are local by default and ignored by git, so private experiments are not accidentally published.

Then test in the browser:

1. Open a page that matches the experiment scope.
2. Open the Crust popup.
3. Enable the experiment.
4. Adjust tweaks if the experiment has them.
5. If you added or removed experiment folders while the popup was already open, click the popup refresh icon.

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

To share with a teammate, prefer a private branch or private repo. If you really want to commit one experiment into git, ask your coding agent:

```text
Share only this Crust experiment:
experiments/<author>/<folder>

Force-add only that folder, commit it with a clear message, and do not add other ignored local experiments.
```

Manual commands:

```sh
git add -f experiments/<author>/<folder>
git commit -m "Add <experiment name>"
git push
```

After teammates pull and run `corepack pnpm dev` or rebuild, the experiment appears in their popup when the active tab matches its scope.

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

## Troubleshooting

- Popup says no experiments yet: run `corepack pnpm dev` or `corepack pnpm build`.
- Experiment is hidden: open a page matching `manifest.json` `scope.match` or `scope.regex`.
- New folder is missing: keep dev mode running and click the popup refresh icon.
- Experiment does not change the page: ask your coding agent to inspect the browser console, Crust errors page, and the experiment `apply` function.
- LLM experiment warns about a missing key: open Crust options and add your provider API key.

---

# Crust Onboarding На Русском

Crust это локальное расширение для браузера, чтобы запускать небольшие дизайн-эксперименты на настоящих сайтах. Оно рассчитано не только на разработчиков, а на работу через AI-инструменты: Cursor, Codex, Claude Code. Ты описываешь, что хочешь поменять на странице, AI-агент редактирует файлы эксперимента, а ты включаешь эксперимент в popup расширения.

Тебе не нужно сразу понимать весь проект. Базовый сценарий такой: один раз настроить проект, держать dev mode включенным, просить AI-агента создавать или менять эксперименты, потом проверять результат в браузере.

## Быстрый Старт Для Cursor, Codex, Claude Code

Сначала нужно скачать проект на компьютер.

Выбери место, где будет лежать папка проекта. Если не уверен, используй `Desktop`, чтобы папку было легко найти через Finder. Открой Terminal и запусти:

```sh
cd ~/Desktop
git clone https://github.com/andreashxc/overlay-plugin.git
cd overlay-plugin
```

После этого на рабочем столе появится папка `overlay-plugin`. Это и есть проект Crust. Если хочешь положить проект в другое место, открой нужную папку в Finder, напиши в Terminal `cd `, перетащи папку в Terminal, нажми Enter, а потом запусти команду `git clone`.

Если команда `git` не работает, сначала установи GitHub Desktop или Xcode Command Line Tools, потом повтори команды.

После этого открой папку `overlay-plugin` в Cursor, Codex или Claude Code и вставь AI-агенту такой запрос:

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
4. Выбери папку `apps/extension/.output/chrome-mv3`.
5. Открой `https://ya.ru/`.
6. Открой popup Crust в toolbar браузера.

Пока работаешь, оставляй `corepack pnpm dev` запущенным. Crust следит за `experiments/**`, обновляет список экспериментов и заново применяет включенные эксперименты без полной перезагрузки расширения.

## Создать Или Изменить Эксперимент

Опиши эксперимент обычным языком. Не нужно придумывать ID, имя папки или красивое название. AI-агент должен сам выбрать название, создать файлы и объяснить, что сделал. Если ему не хватает важной продуктовой информации, он должен сначала задать вопрос.

Вставь примерно такой запрос:

```text
Создай или измени Crust experiment.

Что я хочу:
<опиши поведение эксперимента и визуальный результат>

Где это должно работать:
<перечисли URL страниц или паттерны URL>

Как это должно работать:
<опиши когда появляется, что меняет, что происходит при клике/hover/scroll, какие есть состояния или варианты>

Сам выбери author-папку, имя папки эксперимента, display name, manifest scope и разумные дефолты.
Author-папку определи по моему локальному окружению, если это возможно; спрашивай только если правда не можешь определить.
По умолчанию создай новый эксперимент.
Изменяй существующий эксперимент только если я прямо попросил изменить именно его.

Сделай эксперимент маленьким и обратимым. Добавляй tweak controls только если они помогут тестировать варианты в popup.
После изменений запусти нужные проверки и скажи, что именно мне перезагрузить или проверить в браузере.
```

Пример запроса:

```text
Создай или измени Crust experiment.

Что я хочу:
На ya.ru покажи компактную floating promo-карточку рядом с поиском. Она должна выглядеть нативно для страницы, не как developer demo.

Где это должно работать:
https://ya.ru/

Как это должно работать:
Карточка появляется после загрузки страницы. В ней короткий заголовок, маленькая кнопка закрытия и CTA-кнопка. Закрытие скрывает карточку до выключения и повторного включения эксперимента. Добавь твики для текста заголовка, accent color и позиции карточки.

Сам выбери author-папку, имя папки эксперимента, display name, manifest scope и разумные дефолты.
Author-папку определи по моему локальному окружению, если это возможно; спрашивай только если правда не можешь определить.
По умолчанию создай новый эксперимент.
Изменяй существующий эксперимент только если я прямо попросил изменить именно его.

Сделай эксперимент маленьким и обратимым. После изменений запусти проверки и скажи, что мне тестировать.
```

Обычно агент создаст или изменит:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  description.md
  presets/
```

В публичном GitHub лежат только примеры в `experiments/examples/**`. Твои личные папки вроде `experiments/andrew/**` по умолчанию локальные и игнорируются git, чтобы случайно не запушить приватные эксперименты.

Потом проверь в браузере:

1. Открой страницу, которая подходит под scope эксперимента.
2. Открой popup Crust.
3. Включи эксперимент.
4. Если есть твики, покрути настройки.
5. Если добавлял или удалял папки экспериментов при уже открытом popup, нажми refresh в popup.

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

Если надо поделиться с коллегой, лучше использовать приватную ветку или приватный репозиторий. Если точно хочешь добавить один эксперимент в git, попроси AI-агента:

```text
Опубликуй только этот Crust experiment:
experiments/<author>/<folder>

Force-add только эту папку, сделай понятный commit и не добавляй другие ignored local experiments.
```

Команды вручную:

```sh
git add -f experiments/<author>/<folder>
git commit -m "Add <experiment name>"
git push
```

После `pull` и запуска `corepack pnpm dev` или rebuild эксперимент появится у коллеги в popup, если открытая вкладка подходит под scope.

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

## Если Что-то Не Работает

- В popup нет экспериментов: запусти `corepack pnpm dev` или `corepack pnpm build`.
- Эксперимент не показывается: открой страницу, которая совпадает с `scope.match` или `scope.regex` в `manifest.json`.
- Новая папка не появилась: оставь dev mode запущенным и нажми refresh в popup.
- Эксперимент включается, но страница не меняется: попроси AI-агента проверить browser console, Crust errors page и функцию `apply` в эксперименте.
- LLM experiment пишет, что нет ключа: открой настройки Crust и добавь API key нужного провайдера.
