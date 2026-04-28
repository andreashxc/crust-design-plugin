import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { globSync } from 'glob';

export type DesignContextFinding = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
};

export type DesignContextSection = {
  title: string;
  normalizedTitle: string;
  content: string;
};

export type ParsedDesignContext = {
  filePath: string;
  frontMatter: string;
  body: string;
  tokenPaths: string[];
  tokenCounts: Record<string, number>;
  sections: DesignContextSection[];
  findings: DesignContextFinding[];
  summary: string;
};

export type DesignContextCandidate = {
  filePath: string;
  key: string;
  source: 'root' | 'design-context' | '.crust';
};

export type DesignContextMatch = {
  candidate: DesignContextCandidate;
  score: number;
  reason: string;
};

const CANONICAL_SECTIONS = [
  'overview',
  'colors',
  'typography',
  'layout',
  'elevation depth',
  'shapes',
  'components',
  'dos donts',
];

const SECTION_ALIASES = new Map<string, string>([
  ['brand style', 'overview'],
  ['layout spacing', 'layout'],
  ['elevation', 'elevation depth'],
  ['do s and don ts', 'dos donts'],
  ['do s dont s', 'dos donts'],
  ['dos and donts', 'dos donts'],
]);

function normalizeSectionTitle(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[`*_#]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-zа-яё0-9]+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return SECTION_ALIASES.get(normalized) ?? normalized;
}

function stripInlineComment(value: string): string {
  const hashIndex = value.indexOf(' #');
  return hashIndex === -1 ? value.trim() : value.slice(0, hashIndex).trim();
}

function parseFrontMatter(markdown: string): {
  frontMatter: string;
  body: string;
  findings: DesignContextFinding[];
} {
  const findings: DesignContextFinding[] = [];
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return {
      frontMatter: '',
      body: normalized,
      findings: [
        {
          severity: 'error',
          code: 'missing-front-matter',
          message: 'DESIGN.md must start with YAML front matter delimited by --- fences.',
        },
      ],
    };
  }

  const closeIndex = normalized.indexOf('\n---', 4);
  if (closeIndex === -1) {
    return {
      frontMatter: normalized.slice(4),
      body: '',
      findings: [
        {
          severity: 'error',
          code: 'unclosed-front-matter',
          message: 'DESIGN.md front matter is missing its closing --- fence.',
        },
      ],
    };
  }

  const afterClose = normalized.indexOf('\n', closeIndex + 4);
  return {
    frontMatter: normalized.slice(4, closeIndex),
    body: afterClose === -1 ? '' : normalized.slice(afterClose + 1),
    findings,
  };
}

function parseYamlTokenPaths(frontMatter: string): {
  paths: Set<string>;
  counts: Record<string, number>;
} {
  const paths = new Set<string>();
  const counts: Record<string, number> = {};
  const stack: Array<{ indent: number; path: string }> = [];

  for (const rawLine of frontMatter.split('\n')) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const match = rawLine.match(/^(\s*)(["']?[^:"']+["']?):(?:\s*(.*))?$/u);
    if (!match) continue;

    const indent = match[1]?.length ?? 0;
    const key = (match[2] ?? '').trim().replace(/^["']|["']$/g, '');
    const value = stripInlineComment(match[3] ?? '');
    if (!key || key.startsWith('- ')) continue;

    while (stack.length > 0 && indent <= (stack.at(-1)?.indent ?? 0)) stack.pop();
    const parent = stack.at(-1)?.path;
    const path = parent ? `${parent}.${key}` : key;
    paths.add(path);

    const topLevel = path.split('.')[0];
    if (topLevel && parent) counts[topLevel] = (counts[topLevel] ?? 0) + 1;

    if (!value || value === '>' || value === '|') {
      stack.push({ indent, path });
    }
  }

  return { paths, counts };
}

function parseSections(body: string): DesignContextSection[] {
  const headingPattern = /^##\s+(.+)$/gmu;
  const headings = [...body.matchAll(headingPattern)].map((match) => ({
    title: (match[1] ?? '').trim(),
    index: match.index ?? 0,
    end: (match.index ?? 0) + (match[0]?.length ?? 0),
  }));

  return headings.map((heading, index) => {
    const nextIndex = headings[index + 1]?.index ?? body.length;
    return {
      title: heading.title,
      normalizedTitle: normalizeSectionTitle(heading.title),
      content: body.slice(heading.end, nextIndex).trim(),
    };
  });
}

function validateTokenRefs(
  text: string,
  tokenPaths: Set<string>,
  findings: DesignContextFinding[],
): void {
  const refPattern = /\{([A-Za-z0-9_.-]+)\}/g;
  const missing = new Set<string>();
  for (const match of text.matchAll(refPattern)) {
    const ref = match[1];
    if (ref && !tokenPaths.has(ref)) missing.add(ref);
  }

  for (const ref of [...missing].sort()) {
    findings.push({
      severity: 'error',
      code: 'broken-ref',
      path: ref,
      message: `Token reference {${ref}} does not resolve to a front matter token.`,
    });
  }
}

function validateSections(
  sections: DesignContextSection[],
  findings: DesignContextFinding[],
): void {
  const seen = new Set<string>();
  let lastKnownIndex = -1;

  for (const section of sections) {
    if (seen.has(section.normalizedTitle)) {
      findings.push({
        severity: 'error',
        code: 'duplicate-section',
        path: section.title,
        message: `Duplicate DESIGN.md section: ${section.title}`,
      });
    }
    seen.add(section.normalizedTitle);

    const sectionIndex = CANONICAL_SECTIONS.indexOf(section.normalizedTitle);
    if (sectionIndex === -1) continue;
    if (sectionIndex < lastKnownIndex) {
      findings.push({
        severity: 'warning',
        code: 'section-order',
        path: section.title,
        message: `Section "${section.title}" appears outside the canonical DESIGN.md order.`,
      });
    }
    lastKnownIndex = Math.max(lastKnownIndex, sectionIndex);
  }
}

function firstLines(content: string, maxChars: number): string {
  const compact = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join('\n');
  return compact.length <= maxChars ? compact : `${compact.slice(0, maxChars - 1)}…`;
}

function buildSummary(filePath: string, parsed: Omit<ParsedDesignContext, 'summary'>): string {
  const sectionByName = new Map(
    parsed.sections.map((section) => [section.normalizedTitle, section]),
  );
  const preferredSections = [
    'overview',
    'colors',
    'typography',
    'layout',
    'components',
    'responsive behavior',
    'technical architecture',
    'chrome extension',
    'паттерны и ловушки при разработке расширений',
  ];
  const tokenCounts = Object.entries(parsed.tokenCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ');

  const lines = [
    `# Design Context Summary`,
    ``,
    `Source: ${filePath}`,
    `Tokens: ${tokenCounts || 'none detected'}`,
    `Findings: ${parsed.findings.length}`,
    ``,
    `## Key Sections`,
  ];

  for (const sectionName of preferredSections) {
    const section = sectionByName.get(sectionName);
    if (!section) continue;
    lines.push(``, `### ${section.title}`, firstLines(section.content, 1200));
  }

  return lines.join('\n').trim();
}

export function parseDesignContextFile(filePath: string): ParsedDesignContext {
  const text = readFileSync(filePath, 'utf8');
  const frontMatterResult = parseFrontMatter(text);
  const findings = [...frontMatterResult.findings];
  const { paths, counts } = parseYamlTokenPaths(frontMatterResult.frontMatter);
  const sections = parseSections(frontMatterResult.body);

  if (!paths.has('name')) {
    findings.push({
      severity: 'warning',
      code: 'missing-name',
      message: 'DESIGN.md front matter has no name token.',
    });
  }
  if ([...paths].some((path) => path.startsWith('colors.')) && !paths.has('colors.primary')) {
    findings.push({
      severity: 'warning',
      code: 'missing-primary',
      message: 'Colors are defined but colors.primary is missing.',
    });
  }
  if (
    [...paths].some((path) => path.startsWith('colors.')) &&
    ![...paths].some((path) => path.startsWith('typography.'))
  ) {
    findings.push({
      severity: 'warning',
      code: 'missing-typography',
      message: 'Colors are defined but typography tokens are missing.',
    });
  }

  validateTokenRefs(frontMatterResult.frontMatter, paths, findings);
  validateSections(sections, findings);

  const withoutSummary = {
    filePath,
    frontMatter: frontMatterResult.frontMatter,
    body: frontMatterResult.body,
    tokenPaths: [...paths].sort(),
    tokenCounts: counts,
    sections,
    findings,
  };

  return {
    ...withoutSummary,
    summary: buildSummary(filePath, withoutSummary),
  };
}

export function discoverDesignContexts(root = process.cwd()): DesignContextCandidate[] {
  const candidates: DesignContextCandidate[] = [];
  const rootDesignMd = resolve(root, 'DESIGN.md');
  if (existsSync(rootDesignMd)) {
    candidates.push({ filePath: rootDesignMd, key: 'root', source: 'root' });
  }

  for (const pattern of ['design-context/*/DESIGN.md', '.crust/design-context/*/DESIGN.md']) {
    const source = pattern.startsWith('.crust') ? '.crust' : 'design-context';
    for (const filePath of globSync(pattern, { cwd: root, absolute: true, nodir: true })) {
      candidates.push({
        filePath,
        key: basename(dirname(filePath)),
        source,
      });
    }
  }

  return candidates.sort(
    (a, b) => a.key.localeCompare(b.key) || a.filePath.localeCompare(b.filePath),
  );
}

function normalizeHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, '');
}

function urlHost(urlOrPattern: string): string | null {
  try {
    return normalizeHost(new URL(urlOrPattern).hostname);
  } catch {
    const match = urlOrPattern.match(/(?:\*:\/\/|https?:\/\/)?(?:\*\.)?([^/*]+)/u);
    return match?.[1] ? normalizeHost(match[1]) : null;
  }
}

export function matchDesignContexts(
  urlOrPattern: string,
  candidates: DesignContextCandidate[],
): DesignContextMatch[] {
  const host = urlHost(urlOrPattern);
  if (!host) {
    return candidates
      .filter((candidate) => candidate.key === 'root')
      .map((candidate) => ({ candidate, score: 1, reason: 'root fallback' }));
  }

  return candidates
    .map((candidate): DesignContextMatch | null => {
      const key = normalizeHost(candidate.key);
      if (key === 'root') return { candidate, score: 1, reason: 'root fallback' };
      if (host === key) return { candidate, score: 100, reason: 'exact host match' };
      if (host.endsWith(`.${key}`)) return { candidate, score: 90, reason: 'subdomain match' };
      if (key.includes(host)) return { candidate, score: 60, reason: 'context key contains host' };
      return null;
    })
    .filter((match): match is DesignContextMatch => match !== null)
    .sort((a, b) => b.score - a.score || a.candidate.filePath.localeCompare(b.candidate.filePath));
}

export function designContextHint(root: string, urlOrPattern: string): string | null {
  const matches = matchDesignContexts(urlOrPattern, discoverDesignContexts(root));
  const best = matches[0];
  if (!best || best.score < 50) return null;
  const parsed = parseDesignContextFile(best.candidate.filePath);
  return [
    `Design context matched: ${relative(root, best.candidate.filePath)} (${best.reason}).`,
    `Run this to print the context summary for your AI agent:`,
    `corepack pnpm design-context --url ${urlOrPattern}`,
    parsed.findings.length > 0 ? `Findings: ${parsed.findings.length}` : `Findings: none`,
  ].join('\n');
}

function usage(): never {
  console.error(`Usage:
  corepack pnpm design-context --url <url-or-pattern> [--json]
  corepack pnpm design-context --file <path-to-DESIGN.md> [--json]
  corepack pnpm design-context --list`);
  process.exit(1);
}

function argValue(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function runCli(): void {
  const args = process.argv.slice(2);
  const root = process.cwd();
  const json = args.includes('--json');

  if (args.includes('--list')) {
    const contexts = discoverDesignContexts(root);
    if (json) {
      console.log(JSON.stringify(contexts, null, 2));
      return;
    }
    for (const context of contexts) {
      console.log(`${context.key}\t${relative(root, context.filePath)}\t${context.source}`);
    }
    return;
  }

  const fileArg = argValue(args, '--file');
  const urlArg = argValue(args, '--url');
  if (!fileArg && !urlArg) usage();

  const filePath = fileArg
    ? resolve(root, fileArg)
    : matchDesignContexts(urlArg ?? '', discoverDesignContexts(root))[0]?.candidate.filePath;
  if (!filePath) {
    console.error(`No design context matched: ${urlArg}`);
    process.exit(1);
  }

  const parsed = parseDesignContextFile(filePath);
  if (json) {
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  console.log(parsed.summary);
  if (parsed.findings.length > 0) {
    console.log('\n## Findings');
    for (const finding of parsed.findings) {
      console.log(`- ${finding.severity} ${finding.code}: ${finding.message}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
