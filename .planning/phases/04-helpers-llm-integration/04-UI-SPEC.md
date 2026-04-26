# Phase 4 UI Spec: Options Page + Popup LLM Signals

## Surface

This phase adds the first Curst options page and small LLM-related additions to the existing popup.

The options page is a full extension page (`entrypoints/options/index.html`), opened in a tab. It is not a replacement for the popup. The popup stays focused on experiments for the current page; options manages global provider and safety settings.

## Visual Direction

- Use the same compact dark Curst design language established in Phase 3.
- Use shadcn/ui primitives already present where possible: Button, Input, Select, Switch, Badge, Card/section shells, ScrollArea.
- No marketing hero, no explanatory splash page, no oversized cards.
- Prefer dense grouped sections with clear labels and small status text.
- Keep cards shallow: sections are framed once; do not nest cards inside cards.
- Dark theme is first-class and can be always-on for extension pages.

## Options Page Layout

### Header

- Left: `Curst`
- Right: small status summary, e.g. `OpenAI configured`, `Anthropic missing`, or `2 providers configured`
- Optional link/button: `Open popup` is not required in v1.

### Providers Section

Two provider rows:

- OpenAI
- Anthropic

Each row contains:

- API key input, password masked by default.
- Icon button to show/hide the key.
- Save button.
- Test button.
- Last status label.

Validation:

- Empty key can be saved only as "clear key".
- Test requires non-empty key.
- Failed test shows concise provider error without dumping secrets.

### Defaults Section

Controls:

- Default provider select: OpenAI or Anthropic.
- OpenAI model id input.
- Anthropic model id input.
- Default max output tokens numeric input.

Behavior:

- Model inputs are editable text fields in v1, not hardcoded dropdowns.
- If default provider has no saved key, show an inline warning in this section.

### Cost Guard Section

Controls:

- Cache TTL minutes.
- Max retry attempts.
- Warning threshold for calls per session.
- Apply rate-limit interval in milliseconds.
- Optional switch: "Use cache for identical prompts".

Copy:

- Short helper text: provider-side spend limits are still recommended.
- Avoid long educational copy inside the app.

### Diagnostics Section

Controls/data:

- Current session calls.
- Current session input/output/total tokens if available.
- Last LLM error.
- Last provider test result.
- Clear LLM cache button.
- Reset session counters button.

This section is lower priority and should remain visually quieter than Providers.

## Popup Additions

### Header Counter

When Phase 4 state exists, the popup header adds a compact LLM session indicator:

- Calls: required.
- Tokens: required if provider response includes usage; show `tokens unknown` only in diagnostics, not prominent header chrome.

The existing active experiment count remains.

### Experiment Inline Warning

If an experiment is LLM-capable or attempted `llm()` and the selected provider key is missing:

- Show a small inline warning inside that experiment row.
- No global banner.
- Include a compact action to open options.
- Do not block unrelated non-LLM experiments.

## States

- No providers configured.
- One provider configured.
- Both providers configured.
- Default provider missing key.
- Provider test loading.
- Provider test failed.
- Cache clear success/failure.
- Session counter reset.
- LLM experiment missing selected key.

## Accessibility

- All icon-only buttons need accessible labels.
- Password show/hide must expose current state via label or aria-pressed.
- Provider status must be text, not color-only.
- Warning colors must be legible in dark theme.

## Test Requirements

- React tests cover provider status rendering, key masking toggle, default provider warning, cost guard validation, diagnostics actions, and popup inline missing-key warning.
- Build output must include `options.html`.
- Manual smoke: open extension options page, save/test dummy invalid key, confirm no key is shown in popup/content script state, clear key, confirm LLM experiment row shows inline warning only.

