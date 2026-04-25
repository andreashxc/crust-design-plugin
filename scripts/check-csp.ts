#!/usr/bin/env -S tsx
/**
 * MV3 CSP guardrail (BLD-05).
 *
 * Per CONTEXT D-23 + RESEARCH Step 8: scan apps/**, experiments/** source files
 * for the three forbidden patterns and exit 1 on any match.
 *
 * Trade-off (RESEARCH Step 8): comments containing literal `eval(` (e.g.
 * `// eval('x') is bad`) WILL be flagged. This is intentional — the linter is
 * regex-only by design. Authors should phrase such comments without parens or
 * document the pattern in markdown instead.
 *
 * Forbidden patterns:
 *   - `eval(...)`
 *   - `new Function(...)`
 *   - `import('https://...')` / `import("https://...")`
 *
 * The Chromium MV3 platform CSP rejects all three at runtime. Failing fast at
 * commit time saves a build cycle and protects against accidental introduction.
 */

import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

type ForbiddenPattern = { name: string; re: RegExp };

const PATTERNS: ForbiddenPattern[] = [
  { name: 'eval()', re: /\beval\s*\(/ },
  { name: 'new Function()', re: /\bnew\s+Function\s*\(/ },
  { name: 'remote import()', re: /import\s*\(\s*['"]https?:\/\//i },
];

const INCLUDE = ['apps/**/*.{ts,tsx,js,jsx}', 'experiments/**/*.{ts,js}'];
const IGNORE = ['**/node_modules/**', '**/.output/**', '**/.wxt/**', '**/dist/**'];

function main(): number {
  const files = globSync(INCLUDE, { ignore: IGNORE, nodir: true });
  let violations = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const { name, re } of PATTERNS) {
        if (re.test(line)) {
          console.error(`${file}:${i + 1}: forbidden ${name}: ${line.trim()}`);
          violations++;
        }
      }
    }
  }

  if (violations > 0) {
    console.error(`\ncheck-csp: ${violations} violation(s) found.`);
    return 1;
  }
  return 0;
}

process.exit(main());
