import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  });

  it('formats titles from folders', () => {
    expect(titleFromFolder('pricing_hero-test')).toBe('Pricing Hero Test');
  });
});

describe('createExperiment', () => {
  it('writes Hummer-ready starter files', () => {
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
    expect(manifest.tweaks.map((tweak: { key: string }) => tweak.key)).toEqual([
      'variant',
      'show_annotations',
    ]);
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).toContain('helpers.injectNode');
    expect(readFileSync(resolve(dir, 'experiment.ts'), 'utf8')).not.toContain('innerHTML');
    expect(existsSync(resolve(dir, 'analysis.md'))).toBe(true);
    expect(readFileSync(resolve(dir, 'description.md'), 'utf8')).toContain('How to test in Crust');
    expect(existsSync(resolve(dir, 'presets/conservative.json'))).toBe(true);
    expect(existsSync(resolve(dir, 'presets/balanced.json'))).toBe(true);
    expect(existsSync(resolve(dir, 'presets/exploratory.json'))).toBe(true);
  });
});
