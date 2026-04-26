# Experiment Authoring

Experiments live in `experiments/<author>/<folder>/` and are bundled into the extension. MV3 does not allow Crust to execute JavaScript fetched from git at runtime, so pulled experiments appear after `corepack pnpm dev` refreshes the dev registry or after a rebuild.

## Folder Shape

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  description.md
  presets/
```

The `author` in `manifest.json` must match the folder name under `experiments/`.

## Manifest

`manifest.json` declares identity, scope, execution world, and tweak controls:

```json
{
  "id": "",
  "name": "Search Banner",
  "author": "andrew",
  "description": "Adds a banner to ya.ru",
  "scope": {
    "match": ["*://ya.ru/*", "*://*.ya.ru/*"]
  },
  "world": "isolated",
  "tweaks": []
}
```

Leave `id` empty for a new experiment; the build stamps a stable ULID. Do not change it after teammates have used the experiment, because storage is keyed by ID.

## Tweaks

Crust renders tweak controls from `manifest.json`:

- `toggle`
- `select`
- `text`
- `number-slider`
- `color`
- `multi-select`

Stored local values live in `chrome.storage.local`. Invalid values are rejected before `apply()` runs.

## Experiment Module

`experiment.ts` exports `apply`:

```ts
import type { ApplyFn } from '@platform/experiment-sdk';

export const apply: ApplyFn = ({ tweaks, helpers, currentURL, signal }) => {
  const node = document.createElement('aside');
  node.textContent = String(tweaks.headline ?? currentURL);
  helpers.injectNode(node);
  return () => node.remove();
};
```

Prefer helpers for page side effects so cleanup stays automatic.

## Helpers

- `helpers.injectStyle(css, options?)` tracks injected styles.
- `helpers.injectNode(node, target?, options?)` tracks injected DOM.
- `helpers.waitFor(selectorOrCallback, options?)` waits for page elements.
- `helpers.onUrlChange(callback)` reacts to SPA navigation.
- `helpers.fetchPage(url, selector?)` fetches and parses SSR HTML from the service worker.
- `helpers.llm(prompt, options?)` calls the configured OpenAI or Anthropic provider through the service worker.

Content scripts never receive provider API keys. If an API key is missing, the popup shows a small warning on the affected LLM experiment.

## Presets

Presets are shared repo files in `presets/*.json`:

```json
{
  "name": "compact",
  "values": {
    "headline": "Hello"
  },
  "updatedAt": "2026-04-26T00:00:00.000Z"
}
```

Create one from current values with:

```sh
corepack pnpm save-preset <author>/<folder> <preset-name> '<json-values>'
```

The popup can load presets when they are present in the registry. The popup copy command is intentional: extension pages do not write directly into the repo.

## Descriptions

`description.md` explains the experiment to teammates. Generated descriptions use:

```md
---
generated: true
---
```

Regenerate generated docs with:

```sh
corepack pnpm generate-descriptions
```

Set `generated: false` to make a hand-written description that the generator will not overwrite. The popup warns when a generated description is missing or stale.

## Common Issues

- Build fails on `manifest.author`: rename the folder or fix the author field.
- Experiment does not show in popup: active tab URL does not match `scope`.
- Tweak change does not apply: check validation errors in the popup.
- `helpers.fetchPage` returns `likely_spa_shell`: the page probably needs client-side JS rendering, which v1 does not provide.
- `helpers.llm` fails: configure the provider key in Crust options and check the LLM session counter.
