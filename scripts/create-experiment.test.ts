import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanAndValidate, writeDevExperimentArtifacts } from '../tools/build-experiments';
import {
  createExperiment,
  parseCreateExperimentArgs,
  scopeMatchesForUrl,
  titleFromFolder,
} from './create-experiment';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(resolve(tmpdir(), 'create-experiment-test-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('scopeMatchesForUrl', () => {
  it('generates path-level scope without query or hash', () => {
    expect(scopeMatchesForUrl('https://example.com/pricing?utm=x#top', 'path')).toEqual([
      'https://example.com/pricing*',
    ]);
  });

  it('uses origin-level scope for root paths', () => {
    expect(scopeMatchesForUrl('https://example.com/', 'path')).toEqual(['https://example.com/*']);
  });

  it('generates origin-level scope', () => {
    expect(scopeMatchesForUrl('https://example.com/pricing', 'origin')).toEqual([
      'https://example.com/*',
    ]);
  });

  it('generates apex and wildcard subdomain host scope', () => {
    expect(scopeMatchesForUrl('https://example.com/pricing', 'host')).toEqual([
      'https://example.com/*',
      'https://*.example.com/*',
    ]);
  });

  it('does not generate wildcard subdomains for localhost host scope', () => {
    expect(scopeMatchesForUrl('http://localhost:3000/pricing', 'host')).toEqual([
      'http://localhost:3000/*',
    ]);
  });

  it('does not generate wildcard subdomains for IPv4 host scope', () => {
    expect(scopeMatchesForUrl('http://127.0.0.1:3000/pricing', 'host')).toEqual([
      'http://127.0.0.1:3000/*',
    ]);
  });

  it('does not generate wildcard subdomains for IPv6 host scope', () => {
    expect(scopeMatchesForUrl('http://[::1]:3000/pricing', 'host')).toEqual([
      'http://[::1]:3000/*',
    ]);
  });

  it('rejects non-http URLs', () => {
    expect(() => scopeMatchesForUrl('file:///tmp/page.html', 'path')).toThrow(/http: or https:/);
  });
});

describe('parseCreateExperimentArgs', () => {
  it('keeps old no-url usage compatible with ya.ru', () => {
    const args = parseCreateExperimentArgs(['andrew', 'search-card']);
    expect(args.displayName).toBe('Search Card');
    expect(args.targetUrl).toBe('https://ya.ru/');
    expect(args.matches).toEqual(['*://ya.ru/*', '*://*.ya.ru/*']);
    expect(args.usedLegacyUrlFallback).toBe(true);
  });

  it('parses display name, url, and scope', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--scope',
      'origin',
    ]);
    expect(args.displayName).toBe('Pricing Hero');
    expect(args.matches).toEqual(['https://example.com/*']);
    expect(args.template).toBe('minimal');
  });

  it('parses the template option', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);
    expect(args.template).toBe('hummer');
  });

  it('rejects unknown templates', () => {
    expect(() =>
      parseCreateExperimentArgs(['andrew', 'pricing-hero', '--template', 'full']),
    ).toThrow(/--template must be one of/);
  });

  it('formats titles from folders', () => {
    expect(titleFromFolder('pricing_hero-test')).toBe('Pricing Hero Test');
  });
});

describe('createExperiment', () => {
  it('keeps minimal starter behavior by default', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
    ]);

    const dir = createExperiment(tmpRoot, args);
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));

    expect(manifest.scope.match).toEqual(['https://example.com/pricing*']);
    expect(manifest.description).toContain('Pricing Hero design experiment');
    expect(manifest.tweaks.map((tweak: { key: string }) => tweak.key)).toEqual([
      'variant',
      'show_annotations',
    ]);
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).toContain('helpers.injectNode');
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).not.toContain('innerHTML');
    expect(existsSync(resolve(dir, 'dom.ts'))).toBe(false);
    expect(existsSync(resolve(dir, 'renderer.ts'))).toBe(false);
    expect(existsSync(resolve(dir, 'analysis.md'))).toBe(true);
    expect(readFileSync(resolve(dir, 'description.md'), 'utf8')).toContain('How to test in Crust');
    expect(existsSync(resolve(dir, 'presets/conservative.json'))).toBe(true);
    expect(existsSync(resolve(dir, 'presets/balanced.json'))).toBe(true);
    expect(existsSync(resolve(dir, 'presets/exploratory.json'))).toBe(true);
  });

  it('writes the Hummer template shape', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    const dir = createExperiment(tmpRoot, args);
    const files = [
      'manifest.json',
      'experiment.ts',
      'dom.ts',
      'renderer.ts',
      'styles.ts',
      'copy.ts',
      'analysis.md',
      'description.md',
      'presets/conservative.json',
      'presets/balanced.json',
      'presets/exploratory.json',
    ];

    for (const file of files) expect(existsSync(resolve(dir, file))).toBe(true);
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    expect(manifest.description).toContain('conservative, balanced, and exploratory');
    expect(manifest.world).toBe('isolated');
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).toContain('findMountTarget');
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).toContain('renderPrototype');
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).toContain(
      "await helpers.waitFor('body'",
    );
    expect(readFileSync(resolve(dir, 'dom.ts'), 'utf8')).not.toContain('documentElement');
    expect(readFileSync(resolve(dir, 'renderer.ts'), 'utf8')).not.toContain('innerHTML');
  });

  it('namespaces generated Hummer classes and style id by folder', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing_hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    const dir = createExperiment(tmpRoot, args);
    const experiment = readFileSync(resolve(dir, 'experiment.ts'), 'utf8');
    const renderer = readFileSync(resolve(dir, 'renderer.ts'), 'utf8');
    const styles = readFileSync(resolve(dir, 'styles.ts'), 'utf8');

    expect(experiment).toContain('styleId');
    expect(renderer).toContain('const classPrefix = "crust-pricing-hero"');
    expect(renderer).toContain(['$', '{classPrefix}__title'].join(''));
    expect(renderer).toContain(['$', '{classPrefix}__action'].join(''));
    expect(styles).toContain("export const styleId = 'crust-pricing-hero-styles'");
    expect(styles).toContain('.crust-pricing-hero__title');
    expect(styles).toContain('.crust-pricing-hero__action');
  });

  it('writes Hummer analysis sections', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    const dir = createExperiment(tmpRoot, args);
    const analysis = readFileSync(resolve(dir, 'analysis.md'), 'utf8');

    for (const section of [
      'Input',
      'Page evidence',
      'Diagnosis',
      'Assumptions',
      'Constraints',
      'Conservative branch',
      'Balanced branch',
      'Exploratory branch',
      'Recommendation',
      'Implementation plan',
      'Risks',
      'QA checklist',
    ]) {
      expect(analysis).toContain(`## ${section}`);
    }
  });

  it('describes minimal and Hummer templates accurately', () => {
    const minimalArgs = parseCreateExperimentArgs([
      'andrew',
      'minimal-card',
      'Minimal Card',
      '--url',
      'https://example.com/minimal',
    ]);
    const hummerArgs = parseCreateExperimentArgs([
      'andrew',
      'hummer-card',
      'Hummer Card',
      '--url',
      'https://example.com/hummer',
      '--template',
      'hummer',
    ]);

    const minimalDir = createExperiment(tmpRoot, minimalArgs);
    const hummerDir = createExperiment(tmpRoot, hummerArgs);
    const minimalDescription = readFileSync(resolve(minimalDir, 'description.md'), 'utf8');
    const hummerDescription = readFileSync(resolve(hummerDir, 'description.md'), 'utf8');

    expect(minimalDescription).toContain('Generated minimal Crust starter');
    expect(minimalDescription).not.toContain('Generated Hummer-ready starter');
    expect(minimalDescription).not.toContain('waits for `document.body`');
    expect(hummerDescription).toContain('Generated Hummer-ready starter');
    expect(hummerDescription).toContain('waits for `document.body`');
  });

  it('writes Hummer presets that validate against manifest tweaks', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    createExperiment(tmpRoot, args);
    const result = scanAndValidate(tmpRoot);

    expect(result.errors).toEqual([]);
    expect(result.manifests[0]?.meta.presets.map((preset) => preset.name)).toEqual([
      'balanced',
      'conservative',
      'exploratory',
    ]);
  });

  it('keeps generated manifest descriptions within schema limits', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'long-description',
      'A'.repeat(320),
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    const dir = createExperiment(tmpRoot, args);
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    const result = scanAndValidate(tmpRoot);

    expect(manifest.description).toHaveLength(280);
    expect(result.errors).toEqual([]);
  });

  it('emits a bundle for the Hummer template', () => {
    const args = parseCreateExperimentArgs([
      'andrew',
      'pricing-hero',
      'Pricing Hero',
      '--url',
      'https://example.com/pricing',
      '--template',
      'hummer',
    ]);

    createExperiment(tmpRoot, args);
    const result = writeDevExperimentArtifacts({
      root: tmpRoot,
      outDir: resolve(tmpRoot, 'dist'),
    });

    expect(result.registry[0]?.chunkPath).toMatch(/^chunks\/experiments-andrew__pricing-hero-/);
  });

  it('documents copy.ts in Hummer scaffold shapes', () => {
    for (const path of [
      'docs/HUMMER.md',
      'docs/EXPERIMENT_AUTHORING.md',
      '.codex/skills/crust-hummer/SKILL.md',
    ]) {
      const doc = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(doc).toContain('copy.ts');
    }
  });
});
