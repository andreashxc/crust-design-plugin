# Crust Extension

## Experiment Development

Create a new experiment:

```sh
corepack pnpm create-experiment <author> <folder> [Display name]
```

Examples:

```sh
corepack pnpm create-experiment andrew hero-test "Hero Test"
corepack pnpm create-experiment designer1 search-card
```

Experiments live at:

```text
experiments/<author>/<folder>/
  manifest.json
  experiment.ts
  description.md
  presets/
```

While `corepack pnpm dev` is running, Crust watches `experiments/**` and refreshes
the generated `registry.json` plus experiment chunks when files are added,
changed, or removed. Use the popup refresh button to reload the visible
experiment list if the popup is already open.

`description.md` documents the experiment for teammates. Generated files use
`generated: true` frontmatter so future tooling can refresh them; set
`generated: false` for hand-written docs. Presets live in `presets/*.json` and
use either `{ "name": "...", "values": { ... } }` or a plain values object.

The popup only shows experiments whose `scope.match` or `scope.regex` matches
the active tab URL. New host scopes may still require extension manifest changes
for permissions and content-script matches.
