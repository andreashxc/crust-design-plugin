import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { designContextHint } from './design-context';

export type CreateExperimentScope = 'path' | 'origin' | 'host';

export type CreateExperimentArgs = {
  author: string;
  folder: string;
  displayName: string;
  targetUrl: string;
  scope: CreateExperimentScope;
  matches: string[];
  usedLegacyUrlFallback: boolean;
};

const LEGACY_TARGET_URL = 'https://ya.ru/';
const LEGACY_MATCHES = ['*://ya.ru/*', '*://*.ya.ru/*'];
const VARIANTS = ['conservative', 'balanced', 'exploratory'] as const;

export function titleFromFolder(folder: string): string {
  return folder
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function parseCreateExperimentArgs(argv: string[]): CreateExperimentArgs {
  const positional: string[] = [];
  let targetUrl: string | undefined;
  let scope: CreateExperimentScope = 'path';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      targetUrl = argv[++i];
      if (!targetUrl) throw new Error('--url requires a target URL.');
      continue;
    }
    if (arg === '--scope') {
      const next = argv[++i];
      if (!isCreateExperimentScope(next)) {
        throw new Error('--scope must be one of: path, origin, host.');
      }
      scope = next;
      continue;
    }
    if (arg?.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    if (arg) positional.push(arg);
  }

  const [author, folder, ...nameParts] = positional;
  if (!author || !folder) throw new Error(usageText());
  assertSlug('author', author);
  assertSlug('folder', folder);

  const displayName = nameParts.length > 0 ? nameParts.join(' ') : titleFromFolder(folder);
  const usedLegacyUrlFallback = !targetUrl;
  const effectiveUrl = targetUrl ?? LEGACY_TARGET_URL;

  return {
    author,
    folder,
    displayName,
    targetUrl: effectiveUrl,
    scope,
    matches: usedLegacyUrlFallback ? LEGACY_MATCHES : scopeMatchesForUrl(effectiveUrl, scope),
    usedLegacyUrlFallback,
  };
}

export function scopeMatchesForUrl(targetUrl: string, scope: CreateExperimentScope): string[] {
  const url = parseHttpUrl(targetUrl);
  const origin = url.origin;
  const host = url.hostname;

  if (scope === 'origin') return [`${origin}/*`];
  if (scope === 'host') {
    const matches = [`${origin}/*`];
    if (supportsWildcardSubdomain(host)) {
      matches.push(`${url.protocol}//*.${host}/*`);
    }
    return matches;
  }

  const pathname = url.pathname || '/';
  if (pathname === '/') return [`${origin}/*`];
  return [`${origin}${pathname}*`];
}

function supportsWildcardSubdomain(host: string): boolean {
  return host !== 'localhost' && !isIpv4(host) && !isIpv6(host);
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isIpv6(host: string): boolean {
  return host.includes(':');
}

function parseHttpUrl(targetUrl: string): URL {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid URL: ${targetUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Target URL must use http: or https:: ${targetUrl}`);
  }
  return url;
}

function isCreateExperimentScope(value: unknown): value is CreateExperimentScope {
  return value === 'path' || value === 'origin' || value === 'host';
}

function usageText(): string {
  return 'Usage: corepack pnpm create-experiment <author> <folder> [Display name] --url <target-url> [--scope path|origin|host]';
}

function assertSlug(label: string, value: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value)) {
    throw new Error(
      `${label} must use letters, numbers, "-" or "_" and start with a letter/number.`,
    );
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function createExperiment(root: string, args: CreateExperimentArgs): string {
  const dir = resolve(root, 'experiments', args.author, args.folder);
  if (existsSync(dir)) {
    throw new Error(`Experiment folder already exists: ${dir}`);
  }

  const presetsDir = resolve(dir, 'presets');
  mkdirSync(presetsDir, { recursive: true });

  writeJson(resolve(dir, 'manifest.json'), {
    id: '',
    name: args.displayName,
    author: args.author,
    description: `${args.displayName} design experiment`,
    scope: {
      match: args.matches,
    },
    world: 'isolated',
    tweaks: [
      {
        key: 'variant',
        label: 'Variant',
        type: 'select',
        options: [...VARIANTS],
        default: 'balanced',
      },
      {
        key: 'show_annotations',
        label: 'Show annotations',
        type: 'toggle',
        default: false,
      },
    ],
  });

  writeFileSync(resolve(dir, 'experiment.ts'), experimentSource(args.displayName), 'utf8');
  writeFileSync(resolve(dir, 'analysis.md'), analysisSource(args), 'utf8');
  writeFileSync(resolve(dir, 'description.md'), descriptionSource(args), 'utf8');

  const now = new Date().toISOString();
  for (const variant of VARIANTS) {
    writeJson(resolve(presetsDir, `${variant}.json`), {
      name: variant,
      values: {
        variant,
        show_annotations: false,
      },
      updatedAt: now,
    });
  }

  return dir;
}

function experimentSource(displayName: string): string {
  const safeName = JSON.stringify(displayName);
  return `import type { ApplyFn } from '@platform/experiment-sdk';

const variantLabels: Record<string, string> = {
  conservative: 'Conservative variant',
  balanced: 'Balanced variant',
  exploratory: 'Exploratory variant',
};

export const apply: ApplyFn = ({ helpers, tweaks }) => {
  const variant = String(tweaks.variant ?? 'balanced');
  const showAnnotations = Boolean(tweaks.show_annotations ?? false);
  const label = variantLabels[variant] ?? variantLabels.balanced;

  helpers.injectStyle(\`
    .crust-hummer-starter {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      box-sizing: border-box;
      max-width: min(320px, calc(100vw - 32px));
      padding: 12px 14px;
      border: 1px solid rgba(37, 99, 235, 0.35);
      border-radius: 10px;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.18);
      font: 13px/1.4 system-ui, sans-serif;
    }

    .crust-hummer-starter strong {
      display: block;
      margin-bottom: 2px;
      font-size: 13px;
    }

    .crust-hummer-starter-note {
      margin-top: 8px;
      color: #4b5563;
      font-size: 12px;
    }
  \`, { id: 'crust-hummer-starter-style' });

  const badge = document.createElement('aside');
  badge.className = 'crust-hummer-starter';
  badge.setAttribute('aria-label', 'Crust experiment active');

  const title = document.createElement('strong');
  title.textContent = ${safeName};
  badge.append(title);

  const body = document.createElement('span');
  body.textContent = \`\${label} is active.\`;
  badge.append(body);

  if (showAnnotations) {
    const note = document.createElement('div');
    note.className = 'crust-hummer-starter-note';
    note.textContent = 'Annotation mode is on. Replace this starter with task-specific design rationale.';
    badge.append(note);
  }

  helpers.injectNode(badge);

  return () => {};
};
`;
}

function analysisSource(args: CreateExperimentArgs): string {
  return `# ${args.displayName} Analysis

Generated starter analysis for ${args.author}/${args.folder}.

## Task

TBD: describe the design or product problem this experiment should solve.

## Target URL

${args.targetUrl}

## Current diagnosis

TBD: summarize the current page evidence, hierarchy, friction, and conversion risks.

## Assumptions

- This file was generated as a starter.
- Scope was generated with \`${args.usedLegacyUrlFallback ? 'legacy fallback' : args.scope}\` mode.

## Solution branches

- Conservative: minimal copy, hierarchy, or CTA changes.
- Balanced: meaningful redesign that stays close to the site style.
- Exploratory: stronger layout or content change for higher-risk comparison.

## Recommended direction

TBD: choose one branch after inspecting the page.

## Risks

- Selectors and layout assumptions still need real-page validation.
- Chrome extension permissions require rebuild/reload when the target domain changes.

## QA checklist

- [ ] Experiment appears in the Crust popup on the target URL.
- [ ] Variant tweak changes the visible prototype.
- [ ] Annotation mode can be toggled.
- [ ] Cleanup removes injected DOM and styles.
- [ ] Mobile/responsive behavior has been checked.
`;
}

function descriptionSource(args: CreateExperimentArgs): string {
  const scope = args.matches.map((match) => `- \`${match}\``).join('\n');
  return `---
generated: true
---

# ${args.displayName}

Generated Hummer-ready starter for ${args.author}/${args.folder}.

## Scope

${scope}

## Tweaks

- \`variant\`: compare conservative, balanced, and exploratory branches.
- \`show_annotations\`: show or hide on-page rationale notes.

## How to test in Crust

1. Run \`corepack pnpm dev\` or \`corepack pnpm build:extension\`.
2. Load \`./crust-extension\` in Chrome.
3. Open ${args.targetUrl}.
4. Open the Crust popup and enable this experiment.
5. Try the presets in \`presets/\` or adjust tweaks manually.

This file was generated as a starter. Replace the placeholder experiment with the actual design solution before sharing.
`;
}

function main(): void {
  try {
    const args = parseCreateExperimentArgs(process.argv.slice(2));
    const dir = createExperiment(process.cwd(), args);
    console.log(`Created ${dir}`);
    const contextHint = designContextHint(process.cwd(), args.targetUrl);
    if (contextHint) {
      console.log('');
      console.log(contextHint);
    }
    console.log('Run corepack pnpm dev or corepack pnpm build to stamp the manifest id.');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
