# 07-03 Summary: Parser, Validation, And Prompt Summary

## Completed

- Added `scripts/design-context.ts`.
- Parser reads YAML front matter and markdown body without adding dependencies.
- Validation covers front matter fences, broken token references, duplicate sections, canonical section-order warnings, and common missing-token warnings.
- Summary output includes source path, token counts, finding count, and selected key sections.
- Unknown sections are preserved in parsed output instead of rejected.

## Verification

- `corepack pnpm exec vitest run scripts/design-context.test.ts` passed: 4 tests.
- Large-file smoke against `/Users/andreas/Downloads/DESIGN.md` passed with `Findings: 0`.

