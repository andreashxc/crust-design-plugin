# 07-04 Summary: Experiment Authoring Integration

## Completed

- Added `corepack pnpm design-context --list`.
- Added `corepack pnpm design-context --url <url-or-pattern>`.
- Added `corepack pnpm design-context --file <path-to-DESIGN.md>`.
- `create-experiment` now prints a matching design-context hint for its default ya.ru scope.
- `fork-experiment` now prints a matching design-context hint based on the source manifest scope.

## Verification

- Unit tests cover URL host matching, subdomain matching, and non-leaky hint output.
- Workflows continue normally when no context exists.

