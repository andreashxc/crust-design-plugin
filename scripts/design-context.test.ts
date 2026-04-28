import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  designContextHint,
  discoverDesignContexts,
  matchDesignContexts,
  parseDesignContextFile,
} from './design-context';

const validDesignMd = `---
version: alpha
name: Example Site
colors:
  primary: "#111111"
  surface: "#ffffff"
typography:
  body:
    fontFamily: Arial
    fontSize: 14px
rounded:
  sm: 4px
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
---

## Overview

Native, quiet interface.

## Colors

Use primary only for important controls.

## Typography

Use body for snippets.

## Components

### Button

Small and flat.

## Technical Architecture

React may re-render dynamic blocks.
`;

describe('design context', () => {
  it('parses DESIGN.md front matter, sections, token refs, and summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'crust-design-context-'));
    const filePath = join(root, 'DESIGN.md');
    writeFileSync(filePath, validDesignMd, 'utf8');

    const parsed = parseDesignContextFile(filePath);

    expect(parsed.findings.filter((finding) => finding.severity === 'error')).toHaveLength(0);
    expect(parsed.tokenPaths).toContain('colors.primary');
    expect(parsed.tokenPaths).toContain('components.button.backgroundColor');
    expect(parsed.sections.map((section) => section.title)).toContain('Overview');
    expect(parsed.summary).toContain('Native, quiet interface');
    expect(parsed.summary).toContain('React may re-render dynamic blocks');
  });

  it('reports broken references, duplicate sections, and section order warnings', () => {
    const root = mkdtempSync(join(tmpdir(), 'crust-design-context-'));
    const filePath = join(root, 'DESIGN.md');
    writeFileSync(
      filePath,
      `---
name: Broken
colors:
  primary: "#111111"
components:
  button:
    backgroundColor: "{colors.missing}"
---

## Components
One.

## Colors
Late.

## Colors
Duplicate.
`,
      'utf8',
    );

    const parsed = parseDesignContextFile(filePath);

    expect(parsed.findings.some((finding) => finding.code === 'broken-ref')).toBe(true);
    expect(parsed.findings.some((finding) => finding.code === 'duplicate-section')).toBe(true);
    expect(parsed.findings.some((finding) => finding.code === 'section-order')).toBe(true);
  });

  it('discovers local contexts and matches them by URL host', () => {
    const root = mkdtempSync(join(tmpdir(), 'crust-design-context-'));
    const contextDir = join(root, 'design-context', 'ya.ru');
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'DESIGN.md'), validDesignMd, 'utf8');

    const contexts = discoverDesignContexts(root);
    const matches = matchDesignContexts('https://search.ya.ru/search?text=test', contexts);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.key).toBe('ya.ru');
    expect(matches[0]?.candidate.key).toBe('ya.ru');
    expect(matches[0]?.reason).toBe('subdomain match');
  });

  it('prints a create/fork workflow hint without exposing full context', () => {
    const root = mkdtempSync(join(tmpdir(), 'crust-design-context-'));
    const contextDir = join(root, '.crust', 'design-context', 'ya.ru');
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'DESIGN.md'), validDesignMd, 'utf8');

    const hint = designContextHint(root, '*://*.ya.ru/*');

    expect(hint).toContain('Design context matched');
    expect(hint).toContain('corepack pnpm design-context --url *://*.ya.ru/*');
    expect(hint).not.toContain('Native, quiet interface');
  });
});
