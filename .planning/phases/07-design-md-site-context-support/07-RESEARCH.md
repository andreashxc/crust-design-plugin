# Phase 7 Research: DESIGN.md Site Context

## Source Format

Google Labs `design.md` is currently alpha. The useful stable shape for Crust is:

- YAML front matter between `---` fences.
- Token-like nested maps for colors, typography, spacing, radius, shadows, transitions, and components.
- Markdown sections for rationale, usage rules, examples, and implementation notes.
- Token references in `{path.to.token}` form.

Crust should validate only the structural basics and preserve unknown fields/sections, because the format can change and site-specific files will naturally extend it.

Official source: https://github.com/google-labs-code/design.md

## Supplied ya.ru Context

The supplied `/Users/andreas/Downloads/DESIGN.md` is a real large file, not a toy design token export. It contains:

- design tokens and component maps;
- Russian visual rationale for ya.ru SERP;
- DOM landmarks and selector-level notes;
- responsive behavior;
- technical architecture notes;
- Chrome extension pitfalls gathered from real failures.

The parser smoke produced a compact summary with token counts and key sections, with `Findings: 0`.

## Crust Strategy

- Treat DESIGN.md as authoring-time context for AI coding tools.
- Keep private context out of git and extension artifacts by default.
- Match context by URL host or Chrome match pattern.
- Print a command/hint from create/fork workflows instead of copying private context into experiment folders.
- Summarize large files into deterministic prompt-sized output.

## Risks

- Alpha format may change; keep validation permissive.
- A full DESIGN.md can be too large for prompts; always summarize first.
- Site context may contain private or reverse-engineered details; default ignore rules are required.
- A context summary improves AI output, but visual quality still needs human smoke on the actual page.

