# Phase 7: DESIGN.md Site Context Support

## Goal

Support local, git-private site design context files so AI agents creating Crust experiments understand the target site's visual language, DOM landmarks, responsive behavior, and extension pitfalls before writing code.

## Product Intent

The supplied ya.ru `DESIGN.md` example is not just a token file. It contains:

- Google DESIGN.md-style YAML front matter with tokens for colors, typography, spacing, radius, shadows, transitions, and components.
- Human prose explaining visual rationale and hierarchy.
- DOM/component maps for real target-site blocks.
- Responsive behavior and fixed-size notes.
- Technical architecture notes: React/BEM conventions, globals, URL parameters, script lifecycle.
- Chrome-extension-specific lessons for avoiding flicker, React reverts, bfcache bugs, and observer traps.

Phase 7 should treat this as authoring context for vibe-coders and agents, not as runtime extension data.

## Privacy Model

Design context can contain reverse-engineered site details, private screenshots, client notes, and implementation observations. It must be local by default.

Ignored by default:

- `DESIGN.md`
- `design-context/`
- `.crust/design-context/`

Public examples can be added intentionally later, but must not happen by accident.

## Non-Goals

- No in-extension design editor.
- No runtime loading of private design context into the extension bundle.
- No automatic legal/brand claim that a context file is an official design system for the target site.
- No blind prompt injection of a huge 1,000+ line file into every AI request.

## Source Reference

Google Labs DESIGN.md alpha combines YAML front matter tokens with markdown rationale. Official repo: https://github.com/google-labs-code/design.md

