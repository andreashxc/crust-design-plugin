# Phase 5 UI Spec: DX, Composition, Presets, Sharing

## Surface

Phase 5 extends the existing Crust popup and supporting docs/dev tooling. It does not introduce a new dashboard or landing page.

Primary UI surfaces:

- Popup header and experiment list
- Experiment row action area
- Tweak preset controls inside an enabled experiment row
- Small update-available banner
- Documentation pages for onboarding and authoring

## Visual Direction

- Continue the compact Crust/shadcn visual language from Phase 4.
- Light and dark themes must both work; use existing CSS variables and shadcn primitives.
- Keep spacing strict and dense. The popup is a tool surface, not marketing UI.
- Avoid visible tags/counters when value is zero.
- Keep cards shallow. Do not nest cards inside experiment cards.
- Icon buttons need tooltips or accessible labels; prefer lucide icons over text when the action is familiar.

## Popup Header

Header layout:

- Left: `Crust`
- Right cluster:
  - LLM session text only when calls > 0
  - Reload experiments icon
  - Options icon

Phase 5 additions:

- Search input appears below the header, full width.
- Search placeholder: `Search experiments`
- Search is hidden only if registry is empty.
- Search must not crowd the header icon row.

## Author Groups

- Author groups remain collapsible.
- Header text is `{author}` plus a muted enabled count only when count > 0.
- Groups with no rows after scope + search filtering are hidden.
- If all groups are hidden by search, show a compact empty state: `No matches`.
- If all groups are hidden by page scope, show: `No experiments match this page`.

## Experiment Rows

Rows remain compact cards with:

- title
- short description, max two lines
- toggle
- optional tweak expand control when enabled and tweak definitions exist
- optional action buttons for reorder/open/presets/update diagnostics

Rows must not show status badges like `Off` or `Applied`; the switch and warnings are enough.

## Search

Search behavior:

- Applies after active tab URL scope filtering.
- Matches lowercase `name`, `author`, and `description`.
- Does not search hidden tweak labels or stack traces.
- Keeps author grouping.
- Clears instantly with an icon button inside the input if non-empty.

## Reorder Controls

Visual contract:

- Reorder affordance is compact and low-contrast until hover/focus.
- Use a small grip icon as the drag handle.
- Provide up/down icon buttons as keyboard/test fallback.
- Do not use a kanban/board/list-management visual style.

Behavior:

- Reordering is available for matching experiments in the active page.
- Reordering disabled rows is allowed because it determines future apply order when enabled.
- After reorder, the new order persists and applies on the next reconcile.

## Preset Controls

Preset UI appears only when an experiment has tweak definitions.

Controls:

- Compact preset select/menu when presets exist.
- `Save preset` icon/button inside tweak header or row action area.
- Save flow asks for a preset name.

States:

- No presets: show no persistent empty panel; only `Save preset`.
- Preset loaded: show selected preset name in muted text.
- Save unavailable outside dev bridge: show a copy/download fallback state, not a fake success.
- Save success: concise inline confirmation.
- Save failure: concise inline error with next action.

## Open in Cursor

- Show only when registry metadata contains a local source directory.
- Use a small external/open icon with accessible label `Open in Cursor`.
- If direct `cursor://` opening is unavailable, fallback action copies the local path and shows `Path copied`.

## Toolbar Badge

- Badge text is the current active tab's applied experiment count.
- Hide badge when count is zero.
- Badge text is at most two characters. If count exceeds 99, show `99+`.
- Badge color must be readable in light/dark browser chrome.

## Update Banner

- Show only when a newer remote version is known.
- Position below header/search and above author groups.
- Copy is short: `Update available`.
- Include one small action: `View`.
- Network failures and unknown state do not show a scary error in popup.

## Description/Staleness Warning

- Experiment row may show a small muted warning when `description.md` is missing or stale.
- Do not block toggling.
- Warning copy:
  - `Description missing`
  - `Description stale`
- Prefer showing this only on hover/details or in row actions if visual density becomes high.

## Accessibility

- Search input has accessible label.
- Drag/reorder has keyboard fallback via buttons.
- Icon-only actions have aria labels.
- Update banner is text-based, not color-only.
- Preset save dialog/input has explicit label.
- Focus rings must be visible in both themes.

## Test Requirements

- Component tests cover search filtering, no-match state, reorder buttons, preset load/save states, Open in Cursor visibility, update banner visibility, and zero-count hiding.
- Content/background tests cover toolbar badge text and hidden-zero behavior.
- Manual smoke verifies compact layout in both light and dark themes after enabling multiple experiments and expanding tweaks.
