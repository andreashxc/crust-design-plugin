import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { designContextHint } from './design-context';

export type CreateExperimentScope = 'path' | 'origin' | 'host';
export type CreateExperimentTemplate = 'minimal' | 'hummer';

export type CreateExperimentArgs = {
  author: string;
  folder: string;
  displayName: string;
  targetUrl: string;
  scope: CreateExperimentScope;
  template: CreateExperimentTemplate;
  matches: string[];
  usedLegacyUrlFallback: boolean;
};

const LEGACY_TARGET_URL = 'https://ya.ru/';
const LEGACY_MATCHES = ['*://ya.ru/*', '*://*.ya.ru/*'];
const MAX_MANIFEST_DESCRIPTION_LENGTH = 280;
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
  let template: CreateExperimentTemplate = 'minimal';

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
    if (arg === '--template') {
      const next = argv[++i];
      if (!isCreateExperimentTemplate(next)) {
        throw new Error('--template must be one of: minimal, hummer.');
      }
      template = next;
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
    template,
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

function isCreateExperimentTemplate(value: unknown): value is CreateExperimentTemplate {
  return value === 'minimal' || value === 'hummer';
}

function usageText(): string {
  return 'Usage: corepack pnpm create-experiment <author> <folder> [Display name] --url <target-url> [--scope path|origin|host] [--template minimal|hummer]';
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

function manifestDescriptionFor(args: CreateExperimentArgs): string {
  const description =
    args.template === 'hummer'
      ? `Hummer design experiment for comparing conservative, balanced, and exploratory branches for ${args.displayName}.`
      : `${args.displayName} design experiment`;
  if (description.length <= MAX_MANIFEST_DESCRIPTION_LENGTH) return description;
  return `${description.slice(0, MAX_MANIFEST_DESCRIPTION_LENGTH - 3).trimEnd()}...`;
}

export function createExperiment(root: string, args: CreateExperimentArgs): string {
  const dir = resolve(root, 'experiments', args.author, args.folder);
  if (existsSync(dir)) {
    throw new Error(`Experiment folder already exists: ${dir}`);
  }

  const presetsDir = resolve(dir, 'presets');
  mkdirSync(presetsDir, { recursive: true });
  const manifestDescription = manifestDescriptionFor(args);

  writeJson(resolve(dir, 'manifest.json'), {
    id: '',
    name: args.displayName,
    author: args.author,
    description: manifestDescription,
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

  if (args.template === 'hummer') {
    writeFileSync(resolve(dir, 'experiment.ts'), hummerExperimentSource(), 'utf8');
    writeFileSync(resolve(dir, 'dom.ts'), hummerDomSource(), 'utf8');
    writeFileSync(resolve(dir, 'renderer.ts'), hummerRendererSource(args.displayName), 'utf8');
    writeFileSync(resolve(dir, 'styles.ts'), hummerStylesSource(), 'utf8');
    writeFileSync(resolve(dir, 'copy.ts'), hummerCopySource(), 'utf8');
  } else {
    writeFileSync(resolve(dir, 'experiment.ts'), minimalExperimentSource(args.displayName), 'utf8');
  }
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

function minimalExperimentSource(displayName: string): string {
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

function hummerExperimentSource(): string {
  return `import type { ApplyFn } from '@platform/experiment-sdk';
import { findMountTarget } from './dom';
import { renderPrototype } from './renderer';
import { styles } from './styles';
import { normalizeVariant } from './copy';

export const apply: ApplyFn = ({ helpers, tweaks, currentURL }) => {
  const variant = normalizeVariant(tweaks.variant);
  const showAnnotations = Boolean(tweaks.show_annotations ?? false);
  const mount = findMountTarget(document, currentURL);

  helpers.injectStyle(styles, { id: 'crust-hummer-styles' });
  helpers.injectNode(renderPrototype({ variant, showAnnotations, mount }), mount.parent, {
    position: mount.position,
  });

  return () => {};
};
`;
}

function hummerDomSource(): string {
  return `export type MountTarget = {
  parent: Element;
  position: InsertPosition;
  label: string;
};

export function findMountTarget(doc: Document, currentURL: string): MountTarget {
  const main = firstVisible(doc, ['main', '[role="main"]']);
  if (main) return { parent: main, position: 'afterbegin', label: 'main content' };

  const hero = firstVisible(doc, [
    'header',
    'section[aria-label*="hero" i]',
    'section[class*="hero" i]',
    '[class*="hero" i]',
  ]);
  if (hero) return { parent: hero, position: 'beforeend', label: 'hero/header area' };

  const form = firstVisible(doc, ['form[role="search"]', 'form[action]', 'form']);
  if (form) return { parent: form, position: 'afterend', label: 'primary form' };

  const h1 = firstVisible(doc, ['h1']);
  if (h1?.parentElement) return { parent: h1, position: 'afterend', label: 'primary heading' };

  const body = doc.body;
  if (body) return { parent: body, position: 'afterbegin', label: 'document body' };

  const fallback = doc.documentElement;
  if (fallback) return { parent: fallback, position: 'beforeend', label: 'document root' };

  throw new Error(\`No mount target found for \${currentURL}\`);
}

function firstVisible(doc: Document, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const candidates = Array.from(doc.querySelectorAll(selector));
    const visible = candidates.find(isUsableTarget);
    if (visible) return visible;
  }
  return null;
}

function isUsableTarget(element: Element): boolean {
  if (element.closest('[data-exp-id], [data-crust-owned="true"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}
`;
}

function hummerRendererSource(displayName: string): string {
  const safeName = JSON.stringify(displayName);
  return `import type { MountTarget } from './dom';
import { BRANCH_COPY, type HummerVariant } from './copy';

export type RenderPrototypeArgs = {
  variant: HummerVariant;
  showAnnotations: boolean;
  mount: MountTarget;
};

export function renderPrototype(args: RenderPrototypeArgs): HTMLElement {
  const copy = BRANCH_COPY[args.variant];
  const panel = document.createElement('aside');
  panel.className = 'crust-hummer-prototype';
  panel.dataset.variant = args.variant;
  panel.setAttribute('aria-label', ${safeName});

  const eyebrow = document.createElement('p');
  eyebrow.className = 'crust-hummer-eyebrow';
  eyebrow.textContent = copy.eyebrow;
  panel.append(eyebrow);

  const title = document.createElement('h2');
  title.className = 'crust-hummer-title';
  title.textContent = copy.title;
  panel.append(title);

  const body = document.createElement('p');
  body.className = 'crust-hummer-body';
  body.textContent = copy.body;
  panel.append(body);

  const list = document.createElement('ul');
  list.className = 'crust-hummer-points';
  for (const point of copy.points) {
    const item = document.createElement('li');
    item.textContent = point;
    list.append(item);
  }
  panel.append(list);

  const action = document.createElement('button');
  action.className = 'crust-hummer-action';
  action.type = 'button';
  action.textContent = copy.cta;
  panel.append(action);

  if (args.showAnnotations) {
    const note = document.createElement('p');
    note.className = 'crust-hummer-annotation';
    note.textContent = \`Mounted in \${args.mount.label}. Replace this placeholder with the recommended branch after page evidence is captured.\`;
    panel.append(note);
  }

  return panel;
}
`;
}

function hummerStylesSource(): string {
  return `export const styles = \`
  .crust-hummer-prototype {
    box-sizing: border-box;
    width: min(100%, 720px);
    margin: 16px 0;
    padding: 16px;
    border: 1px solid rgba(17, 24, 39, 0.18);
    border-radius: 8px;
    background: #ffffff;
    color: #111827;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .crust-hummer-eyebrow,
  .crust-hummer-body,
  .crust-hummer-annotation {
    margin: 0;
  }

  .crust-hummer-eyebrow {
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .crust-hummer-title {
    margin: 6px 0;
    color: inherit;
    font-size: 20px;
    line-height: 1.2;
  }

  .crust-hummer-points {
    display: grid;
    gap: 6px;
    margin: 12px 0;
    padding-left: 18px;
  }

  .crust-hummer-action {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 6px;
    background: #111827;
    color: #ffffff;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .crust-hummer-annotation {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed rgba(17, 24, 39, 0.24);
    color: #4b5563;
    font-size: 12px;
  }
\`;
`;
}

function hummerCopySource(): string {
  return `export const HUMMER_VARIANTS = ['conservative', 'balanced', 'exploratory'] as const;

export type HummerVariant = (typeof HUMMER_VARIANTS)[number];

export type BranchCopy = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  cta: string;
};

export const BRANCH_COPY: Record<HummerVariant, BranchCopy> = {
  conservative: {
    eyebrow: 'Conservative branch',
    title: 'Clarify the existing value without changing the page structure',
    body: 'Use this branch when the safest improvement is tighter hierarchy, clearer copy, and a more obvious next action.',
    points: ['Preserves the current layout', 'Improves first-screen comprehension', 'Lowest implementation risk'],
    cta: 'Review conservative option',
  },
  balanced: {
    eyebrow: 'Balanced branch',
    title: 'Add a focused decision block that supports the primary action',
    body: 'Use this branch when the page needs a stronger explanation and CTA sequence while still feeling native to the site.',
    points: ['Adds a compact supporting module', 'Makes the primary action easier to evaluate', 'Best default impact/risk tradeoff'],
    cta: 'Review balanced option',
  },
  exploratory: {
    eyebrow: 'Exploratory branch',
    title: 'Test a more opinionated product story and interaction path',
    body: 'Use this branch when the task allows a bolder prototype that reframes the page section or introduces a new interaction.',
    points: ['Changes the page narrative more visibly', 'Surfaces a stronger product hypothesis', 'Highest validation risk'],
    cta: 'Review exploratory option',
  },
};

export function normalizeVariant(value: unknown): HummerVariant {
  return HUMMER_VARIANTS.includes(value as HummerVariant) ? (value as HummerVariant) : 'balanced';
}
`;
}

function analysisSource(args: CreateExperimentArgs): string {
  return `# ${args.displayName} Analysis

Generated ${args.template} starter analysis for ${args.author}/${args.folder}.

## Input

- Target URL: ${args.targetUrl}
- Scope mode: ${args.usedLegacyUrlFallback ? 'legacy fallback' : args.scope}
- Template: ${args.template}
- Task: TBD
- Business goal: TBD
- Design freedom: TBD
- References: none unless explicitly allowed

## Page evidence

TBD: capture visible copy, structure, DOM anchors, screenshots/notes, responsive observations, and any local design context used before implementation.

## Diagnosis

TBD: summarize the current hierarchy, user intent fit, friction, trust gaps, CTA clarity, accessibility basics, and conversion risks.

## Assumptions

- This file was generated as a starter.
- Target page evidence still needs to be captured and documented.

## Constraints

- Keep the implementation as a Crust experiment.
- Do not clone references or copy brand assets/exact text.
- Avoid broad core changes unless a reusable platform capability is explicitly needed.

## Conservative branch

TBD: minimal structure changes, safer copy/hierarchy/CTA improvements, expected impact, and risks.

## Balanced branch

TBD: meaningful design change that stays close to the existing site style, expected impact, and risks.

## Exploratory branch

TBD: stronger product/UI hypothesis, higher-risk changes, expected impact, and risks.

## Recommendation

TBD: choose one branch and justify why it best fits the task, business goal, constraints, and implementation risk.

## Implementation plan

TBD: list DOM anchors, rendering approach, tweaks, cleanup behavior, responsive handling, and QA steps.

## Risks

- Selectors and layout assumptions still need real-page validation.
- Chrome extension permissions require rebuild/reload when the target domain changes.

## QA checklist

- [ ] Experiment appears in the Crust popup on the target URL.
- [ ] Variant tweak changes the visible prototype.
- [ ] Annotation mode can be toggled.
- [ ] Cleanup removes injected DOM and styles.
- [ ] No unsafe \`innerHTML\` or copied reference assets/text.
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
