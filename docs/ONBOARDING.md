# Crust Onboarding

Crust is a local Chromium MV3 extension for running repo-based design experiments on real pages.

## First Run

1. Clone the repo.

```sh
git clone git@github.com:andreashxc/overlay-plugin.git
cd overlay-plugin
```

2. Install dependencies.

```sh
corepack enable
corepack pnpm install
```

3. Start dev mode.

```sh
corepack pnpm dev
```

4. Load the extension in Chrome or another Chromium browser.

- Open `chrome://extensions`.
- Enable Developer mode.
- Click "Load unpacked".
- Select `apps/extension/.output/chrome-mv3`.

5. Open `https://ya.ru/`, then open the Crust toolbar popup.

## Create Your First Experiment

Create an experiment folder under your author name:

```sh
corepack pnpm create-experiment <author> <folder> [Display name]
```

Example:

```sh
corepack pnpm create-experiment andrew search-banner "Search Banner"
```

This creates:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  description.md
  presets/
```

Keep `corepack pnpm dev` running. Crust watches `experiments/**`; changes should refresh the dev registry and reapply enabled experiments without reloading the extension.

## Daily Workflow

- Edit `experiment.ts`, `manifest.json`, presets, or `description.md`.
- Use the popup refresh button if the popup was already open and you added or removed folders.
- Test on `https://ya.ru/` or the URL matched by your manifest scope.
- Save shareable tweak values with:

```sh
corepack pnpm save-preset <author>/<folder> <preset-name> '<json-values>'
```

- Regenerate generated descriptions with:

```sh
corepack pnpm generate-descriptions
```

## Share With Teammates

Commit and push your experiment:

```sh
git add experiments/<author>/<folder>
git commit -m "Add <experiment name>"
git push
```

After teammates pull and run `corepack pnpm dev` or rebuild, your experiment appears in their popup when the active tab matches its scope.

## Install From a Release

Release tags produce sideload artifacts in GitHub Releases:

- WXT Chrome zip, for example `platformextension-0.0.0-chrome.zip`
- `crust-chrome-mv3-unpacked.zip` for "Load unpacked"

To install a release build:

1. Download `crust-chrome-mv3-unpacked.zip`.
2. Unzip it locally.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click "Load unpacked".
6. Select the unzipped `chrome-mv3` folder.

Crust does not currently publish a signed `.crx` without a configured release signing key. Use the unpacked zip for v1 sideload testing.

## Troubleshooting

- Popup says no experiments yet: run `corepack pnpm dev` or `corepack pnpm build`.
- Experiment is hidden: open a page matching `manifest.json` `scope.match` or `scope.regex`.
- New folder is missing: keep dev mode running and use the popup reload button.
- LLM experiment warns about missing key: open Crust options and add your provider API key.
