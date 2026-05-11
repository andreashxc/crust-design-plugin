import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { globSync } from 'glob';

export const FALLBACK_EXTENSION_MATCHES = ['*://ya.ru/*', '*://*.ya.ru/*'];

export type ExtensionPermissionSet = {
  contentMatches: string[];
  hostPermissions: string[];
  webAccessibleMatches: string[];
  warnings: string[];
};

export function experimentMatchesForExtension(root: string): ExtensionPermissionSet {
  const warnings: string[] = [];
  const matches = new Set<string>();

  for (const manifestPath of globSync('experiments/*/*/manifest.json', {
    cwd: root,
    absolute: true,
  }).sort()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      throw new Error(
        `Failed to parse ${relative(root, manifestPath)} while generating extension permissions: ${String(
          err,
        )}`,
      );
    }

    const scope = isRecord(parsed) ? parsed.scope : undefined;
    const match = isRecord(scope) ? scope.match : undefined;
    if (!Array.isArray(match)) continue;

    for (const pattern of match) {
      if (typeof pattern !== 'string' || !pattern.trim()) continue;
      matches.add(pattern);
    }
  }

  const contentMatches = Array.from(matches).sort();
  const effectiveContentMatches =
    contentMatches.length > 0 ? contentMatches : [...FALLBACK_EXTENSION_MATCHES];
  const hostPermissions = Array.from(
    new Set(
      effectiveContentMatches.flatMap((pattern) => {
        const normalized = hostPermissionForMatch(pattern);
        if (!normalized) {
          warnings.push(`Skipped unsupported match pattern for host permission: ${pattern}`);
          return [];
        }
        return [normalized];
      }),
    ),
  ).sort();

  return {
    contentMatches: effectiveContentMatches,
    hostPermissions,
    webAccessibleMatches: hostPermissions,
    warnings,
  };
}

export function hostPermissionForMatch(pattern: string): string | null {
  const match = /^(?<scheme>\*|http|https):\/\/(?<host>[^/]+)\/.*$/.exec(pattern);
  const groups = match?.groups;
  if (!groups?.scheme || !groups.host) return null;
  if (!isSupportedHost(groups.host)) return null;
  return `${groups.scheme}://${groups.host}/*`;
}

function isSupportedHost(host: string): boolean {
  return host === '*' || host.startsWith('*.') || /^[a-z0-9.-]+$/i.test(host);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
