# Phase 3: Tweak System - UI Spec

**Surface:** Chromium MV3 popup plus one reference in-page Shadow DOM panel.
**Visual system:** Continue Phase 2 shadcn/new-york/slate CSS variable setup.

## Popup Layout

- Keep `360px` popup width and current compact header.
- Filter rows to experiments matching the active tab URL. If no experiments match, show a scoped empty state.
- Experiment rows remain single cards. Tweak controls appear inside the existing row, below status/toggle, not inside nested cards.
- Author groups stay collapsible. Default open if the group has matching experiments.

## Tweak Controls

| Type | Control | Behavior |
|------|---------|----------|
| `toggle` | Switch | Immediate write/apply |
| `select` | Select | Immediate write/apply |
| `text` | Input | Local draft, debounced write 400ms |
| `number-slider` | Slider + numeric value text | Local draft, debounced write 300ms |
| `color` | Native color input styled as swatch/button | Immediate write/apply |
| `multi-select` | Checkbox list or compact menu | Write on each option toggle |

Each control shows:

- label
- optional short description
- validation message if invalid

## Reset

- Row-level `Reset` button appears when an experiment has tweak declarations.
- Reset clears stored values and reapplies defaults.
- No confirmation dialog in Phase 3; reset is local and recoverable.

## Errors

- Runtime experiment errors keep Phase 2 error display.
- Tweak validation errors show near the control and prevent apply.
- Validation errors must not look like auto-disable circuit breaker errors.

## Shadow DOM Panel

- Reference panel is intentionally small.
- It must be mounted in a ShadowRoot.
- It must not inject global CSS into the host page.
- If Radix portals are used later, portal containers must be scoped inside the shadow root. Phase 3 reference panel should avoid portal-heavy controls.
