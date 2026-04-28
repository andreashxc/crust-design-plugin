# 07-02 Summary: Storage Convention, Privacy, And Docs

## Completed

- Added git ignore rules for root `DESIGN.md`, `design-context/`, and `.crust/design-context/`.
- Documented local context paths in `docs/EXPERIMENT_AUTHORING.md`.
- Updated English and Russian onboarding prompts so vibe-coders can provide behavior/page intent while the AI agent uses matching site context.

## Verification

- `git check-ignore -v DESIGN.md design-context/ya.ru/DESIGN.md .crust/design-context/ya.ru/DESIGN.md` confirms all private context paths are ignored by default.

