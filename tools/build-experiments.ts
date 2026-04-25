/**
 * Vite plugin: discover, validate, and ULID-stamp experiments at build time.
 *
 * Per CONTEXT D-17 (ULID auto-gen), D-18 (author == folder), D-20 (discovery),
 *      D-21 (Zod validation), D-22 (no registry.json — Phase 2).
 * Per BLD-01 + BLD-02 + MAN-01.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { ExperimentManifest } from '@platform/experiment-sdk';
import { globSync } from 'glob';
import { ulid } from 'ulid';
import type { Plugin } from 'vite';

export type BuildExperimentsOptions = {
  /** Repo root containing the `experiments/` folder. Defaults to `process.cwd()`. */
  root?: string;
};

export function buildExperiments(options: BuildExperimentsOptions = {}): Plugin {
  const root = options.root ?? process.cwd();
  return {
    name: 'platform:build-experiments',
    buildStart() {
      const result = scanAndValidate(root);
      if (result.errors.length > 0) {
        throw new Error(formatErrors(result.errors));
      }
      // result.warnings are informational (e.g., ULID written) — already logged.
    },
  };
}

// ---- Pure helpers (exported for tests) ----

export type ManifestEntry = {
  path: string;
  data: ReturnType<typeof ExperimentManifest.parse>;
};

export type ScanResult = {
  manifests: ManifestEntry[];
  errors: BuildExperimentError[];
  warnings: string[];
};

export type BuildExperimentError = {
  file: string;
  kind: 'parse' | 'schema' | 'author-mismatch';
  issues: Array<{ path: string; message: string }>;
};

export function scanAndValidate(root: string): ScanResult {
  // Discover all `experiments/<author>/<id>/manifest.json` — depth exactly 2.
  const matches = globSync('experiments/*/*/manifest.json', { cwd: root, absolute: true });

  const manifests: ManifestEntry[] = [];
  const errors: BuildExperimentError[] = [];
  const warnings: string[] = [];

  for (const absPath of matches) {
    const fileRel = relative(root, absPath);
    let parsedJson: unknown;
    try {
      const raw = readFileSync(absPath, 'utf8');
      parsedJson = JSON.parse(raw);
    } catch (err) {
      errors.push({
        file: fileRel,
        kind: 'parse',
        issues: [{ path: '<root>', message: `JSON parse failed: ${String(err)}` }],
      });
      continue;
    }

    // ULID write-back (D-17). Only when id is missing OR empty string OR null.
    if (parsedJson && typeof parsedJson === 'object') {
      const obj = parsedJson as { id?: unknown };
      if (!('id' in obj) || obj.id === '' || obj.id == null) {
        const newId = ulid();
        (parsedJson as { id: string }).id = newId;
        // Preserve the canonical formatting heuristic: 2-space indent + trailing newline.
        const out = `${JSON.stringify(parsedJson, null, 2)}\n`;
        writeFileSync(absPath, out, 'utf8');
        const msg = `[build-experiments] Wrote new id to ${fileRel} — please commit`;
        console.log(msg);
        warnings.push(msg);
      }
    }

    // Zod validation (D-21 / BLD-02).
    const parsed = ExperimentManifest.safeParse(parsedJson);
    if (!parsed.success) {
      errors.push({
        file: fileRel,
        kind: 'schema',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
          message: issue.message,
        })),
      });
      continue;
    }

    // Author-vs-folder check (D-18).
    const expectedAuthor = authorFromPath(fileRel);
    if (expectedAuthor !== parsed.data.author) {
      errors.push({
        file: fileRel,
        kind: 'author-mismatch',
        issues: [
          {
            path: 'author',
            message: `manifest.author "${parsed.data.author}" must match folder name "${expectedAuthor}"`,
          },
        ],
      });
      continue;
    }

    manifests.push({ path: fileRel, data: parsed.data });
  }

  return { manifests, errors, warnings };
}

/**
 * Given `experiments/andrew/smoke/manifest.json`, returns `andrew`.
 * Works on POSIX and Windows path separators.
 */
export function authorFromPath(fileRel: string): string {
  const parts = fileRel.split(sep).filter(Boolean);
  // Expect: ['experiments', '<author>', '<id>', 'manifest.json']
  if (parts.length !== 4 || parts[0] !== 'experiments' || parts[3] !== 'manifest.json') {
    return '<unknown>';
  }
  return parts[1] ?? '<unknown>';
}

export function formatErrors(errors: BuildExperimentError[]): string {
  const lines: string[] = ['Manifest validation failed:'];
  for (const e of errors) {
    lines.push(`  ${e.file}`);
    for (const issue of e.issues) {
      lines.push(`    - ${issue.path}: ${issue.message}`);
    }
  }
  return lines.join('\n');
}

/** Resolve repo root from a known marker (pnpm-workspace.yaml). Used by tests. */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    try {
      readFileSync(resolve(dir, 'pnpm-workspace.yaml'), 'utf8');
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return startDir;
}
