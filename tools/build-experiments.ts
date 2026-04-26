/**
 * Vite plugin: discover, validate, and ULID-stamp experiments at build time.
 *
 * Per CONTEXT D-17 (ULID auto-gen), D-18 (author == folder), D-20 (discovery),
 *      D-21 (Zod validation), D-22 (no registry.json — Phase 2).
 * Per BLD-01 + BLD-02 + MAN-01.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { RegistryEntry } from '@platform/experiment-sdk';
import { ExperimentManifest } from '@platform/experiment-sdk';
import { buildSync } from 'esbuild';
import { globSync } from 'glob';
import type { OutputBundle, OutputChunk } from 'rollup';
import { ulid } from 'ulid';
import type { Plugin } from 'vite';

export type BuildExperimentsOptions = {
  /** Repo root containing the `experiments/` folder. Defaults to `process.cwd()`. */
  root?: string;
  /**
   * Extension output dir used by WXT dev. In production builds Rollup emits files
   * through `generateBundle`; in dev we write registry/chunks here so new folders
   * can appear without a manual rebuild command.
   */
  devOutDir?: string;
  /** Disable the dev watcher in tests or unusual embed contexts. Defaults to true. */
  devWatch?: boolean;
};

export function buildExperiments(options: BuildExperimentsOptions = {}): Plugin {
  const root = options.root ?? process.cwd();
  let scan: ReturnType<typeof scanAndValidate> | null = null;
  return {
    name: 'platform:build-experiments',
    buildStart() {
      scan = scanAndValidate(root);
      if (scan.errors.length > 0) {
        throw new Error(formatErrors(scan.errors));
      }
      // result.warnings are informational (e.g., ULID written) — already logged.
    },
    configureServer(server) {
      if (options.devWatch === false || !options.devOutDir) return;

      const experimentsPattern = resolve(root, 'experiments/**/*');
      server.watcher.add(experimentsPattern);

      let timer: ReturnType<typeof setTimeout> | null = null;
      const refresh = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          try {
            const result = writeDevExperimentArtifacts({
              root,
              outDir: options.devOutDir ?? '',
            });
            server.config.logger.info(
              `[build-experiments] refreshed ${result.registry.length} experiments`,
            );
            server.ws.send({ type: 'full-reload' });
          } catch (err) {
            server.config.logger.error(
              `[build-experiments] dev refresh failed:\n${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }, 75);
      };

      const onFsEvent = (file: string) => {
        if (isExperimentPath(root, file)) refresh();
      };
      server.watcher.on('add', onFsEvent);
      server.watcher.on('change', onFsEvent);
      server.watcher.on('unlink', onFsEvent);
      server.watcher.on('addDir', onFsEvent);
      server.watcher.on('unlinkDir', onFsEvent);

      refresh();
    },
    generateBundle(_options, bundle: OutputBundle) {
      if (!scan) return;

      const chunkByExperimentPath = new Map<string, string>();
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'chunk') continue;
        const chunk = asset as OutputChunk;
        const facade = chunk.facadeModuleId;
        if (!facade) continue;
        if (/[/\\]experiments[/\\][^/\\]+[/\\][^/\\]+[/\\]experiment\.ts$/.test(facade)) {
          chunkByExperimentPath.set(resolve(facade), fileName);
        }
      }

      const registry = createRegistryEntries({
        root,
        scan,
        chunkByExperimentPath,
        emitFile: this.emitFile.bind(this),
      });

      this.emitFile({
        type: 'asset',
        fileName: 'registry.json',
        source: `${JSON.stringify(registry, null, 2)}\n`,
      });
    },
  };
}

export function writeDevExperimentArtifacts(args: { root: string; outDir: string }): {
  registry: RegistryEntry[];
  warnings: string[];
} {
  const scan = scanAndValidate(args.root);
  if (scan.errors.length > 0) {
    throw new Error(formatErrors(scan.errors));
  }

  mkdirSync(args.outDir, { recursive: true });
  const chunksDir = resolve(args.outDir, 'chunks');
  for (const oldChunk of globSync('experiments-*.js', { cwd: chunksDir, absolute: true })) {
    rmSync(oldChunk, { force: true });
  }

  const registry = createRegistryEntries({
    root: args.root,
    scan,
    chunkByExperimentPath: new Map(),
    emitFile: (asset) => {
      const absPath = resolve(args.outDir, asset.fileName);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, asset.source, 'utf8');
      return asset.fileName;
    },
  });

  writeFileSync(resolve(args.outDir, 'registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
  return { registry, warnings: scan.warnings };
}

export function isExperimentPath(root: string, file: string): boolean {
  const rel = relative(resolve(root, 'experiments'), resolve(file));
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}

function createRegistryEntries(args: {
  root: string;
  scan: ScanResult;
  chunkByExperimentPath: Map<string, string>;
  emitFile: (asset: { type: 'asset'; fileName: string; source: string }) => string;
}): RegistryEntry[] {
  return args.scan.manifests.map(({ path, data }) => {
    const manifestAbsPath = resolve(args.root, path);
    const experimentDir = dirname(manifestAbsPath);
    const folder = experimentDir.split(/[/\\]/).pop() ?? '';
    const absExperimentTs = resolve(experimentDir, 'experiment.ts');
    const chunkPath =
      args.chunkByExperimentPath.get(absExperimentTs) ??
      emitExperimentChunk({
        emitFile: args.emitFile,
        absExperimentTs,
        author: data.author,
        folder,
      });

    return {
      id: data.id,
      author: data.author,
      folder,
      name: data.name,
      description: data.description,
      scope: data.scope,
      world: data.world,
      chunkPath,
      tweaks: data.tweaks,
    };
  });
}

function emitExperimentChunk(args: {
  emitFile: (asset: { type: 'asset'; fileName: string; source: string }) => string;
  absExperimentTs: string;
  author: string;
  folder: string;
}): string {
  if (!existsSync(args.absExperimentTs)) return '';

  const output = buildSync({
    entryPoints: [args.absExperimentTs],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
    sourcemap: false,
    legalComments: 'none',
  }).outputFiles[0]?.text;

  if (!output) return '';

  const hash = createHash('sha256').update(output).digest('hex').slice(0, 8);
  const fileName = `chunks/experiments-${args.author}__${args.folder}-${hash}.js`;
  args.emitFile({ type: 'asset', fileName, source: output });
  return fileName;
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
  kind: 'parse' | 'schema' | 'author-mismatch' | 'duplicate-tweak-key';
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

    const duplicateTweakKey = findDuplicateTweakKey(parsed.data.tweaks);
    if (duplicateTweakKey) {
      errors.push({
        file: fileRel,
        kind: 'duplicate-tweak-key',
        issues: [
          {
            path: 'tweaks',
            message: `duplicate tweak key "${duplicateTweakKey}"`,
          },
        ],
      });
      continue;
    }

    manifests.push({ path: fileRel, data: parsed.data });
  }

  return { manifests, errors, warnings };
}

function findDuplicateTweakKey(tweaks: unknown[]): string | null {
  const seen = new Set<string>();
  for (const tweak of tweaks) {
    if (!tweak || typeof tweak !== 'object' || !('key' in tweak)) continue;
    const key = (tweak as { key?: unknown }).key;
    if (typeof key !== 'string') continue;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
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
