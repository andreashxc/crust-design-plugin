/**
 * Tests for scripts/check-csp.ts (BLD-05).
 *
 * Each test creates a temp directory tree, writes fixture files into it, and
 * spawns the check-csp script with that temp dir as cwd. The script's globs
 * are repo-relative (apps/**, experiments/**) so the temp cwd controls what
 * the script sees.
 *
 * Coverage requirements (per Plan 01-05 acceptance criteria, ≥10 cases):
 *   - clean tree
 *   - eval() in apps/
 *   - eval() in experiments/
 *   - new Function()
 *   - remote import() single quotes
 *   - remote import() double quotes
 *   - local dynamic imports OK
 *   - https in string literal that is not import OK
 *   - word-boundary semantics: `evaluator()` is NOT flagged
 *   - line number accuracy
 *   - multi-violation count
 *   - ignored directories (.output, .wxt, node_modules)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Resolve repo root from this test file's location: scripts/check-csp.test.ts
// is at <repo-root>/scripts/, so dirname(...)/.. is the repo root.
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_FILE_DIR, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/check-csp.ts');
const TSX_BIN = resolve(REPO_ROOT, 'node_modules/.bin/tsx');

type RunResult = { code: number; stdout: string; stderr: string };

function runCheckCspIn(cwd: string): RunResult {
  try {
    const stdout = execFileSync(TSX_BIN, [SCRIPT_PATH], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    return {
      code: e.status ?? 1,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
    };
  }
}

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = resolve(
    tmpdir(),
    `check-csp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(resolve(tmpRoot, 'apps'), { recursive: true });
  mkdirSync(resolve(tmpRoot, 'experiments'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = resolve(tmpRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

describe('check-csp script (BLD-05)', () => {
  it('exits 0 on a clean file tree', () => {
    writeFile('apps/extension/src/clean.ts', 'export const x = 1;\n');
    writeFile('experiments/andrew/smoke/experiment.ts', 'export const apply = () => () => {};\n');
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(0);
  });

  it('flags eval() in apps/', () => {
    writeFile('apps/extension/src/bad.ts', "const x = eval('1+1');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/forbidden eval\(\)/);
    expect(r.stderr).toMatch(/apps\/extension\/src\/bad\.ts:1/);
  });

  it('flags eval() in experiments/', () => {
    writeFile('experiments/andrew/bad/experiment.ts', 'eval("1");\n');
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/forbidden eval\(\)/);
  });

  it('flags new Function()', () => {
    writeFile('apps/extension/src/bad.ts', "const f = new Function('return 1');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/forbidden new Function\(\)/);
  });

  it('flags remote import("https://...") with single quotes', () => {
    writeFile('apps/extension/src/bad.ts', "await import('https://example.com/x.js');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/forbidden remote import\(\)/);
  });

  it('flags remote import("https://...") with double quotes', () => {
    writeFile('apps/extension/src/bad.ts', 'import("https://cdn.example.com/x.js");\n');
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/forbidden remote import\(\)/);
  });

  it('does NOT flag local dynamic imports', () => {
    writeFile('apps/extension/src/ok.ts', "await import('./other.ts');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(0);
  });

  it('does NOT flag https:// in a string literal that is not an import', () => {
    writeFile('apps/extension/src/ok.ts', "const url = 'https://ya.ru/';\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(0);
  });

  it('does NOT flag function names that contain "eval" as a substring', () => {
    // The \b word boundary should prevent matching "evaluator" but NOT "eval ("
    writeFile('apps/extension/src/ok.ts', 'function evaluator() { return 1; }\nevaluator();\n');
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(0);
  });

  it('reports line numbers correctly for multi-line files', () => {
    writeFile(
      'apps/extension/src/bad.ts',
      "// line 1\nconst safe = 1;\nconst bad = eval('1');\nconst more = 'a';\n",
    );
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/bad\.ts:3:/);
  });

  it('counts multiple violations across files', () => {
    writeFile('apps/extension/src/bad1.ts', "eval('a');\n");
    writeFile('apps/extension/src/bad2.ts', "new Function('b');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/2 violation/);
  });

  it('ignores .output/, .wxt/, node_modules/', () => {
    writeFile('apps/extension/.output/chrome-mv3/has-eval.js', "eval('1');\n");
    writeFile('apps/extension/.wxt/types/has-eval.ts', "eval('1');\n");
    writeFile('apps/extension/node_modules/some-pkg/has-eval.js', "eval('1');\n");
    const r = runCheckCspIn(tmpRoot);
    expect(r.code).toBe(0);
  });
});
