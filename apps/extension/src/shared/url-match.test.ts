import { describe, expect, it } from 'vitest';
import { matchesScope, matchesUrl } from './url-match';

describe('matchesUrl (Chrome match-patterns + R6 apex/subdomain)', () => {
  it('https://ya.ru/ matches *://ya.ru/*', () => {
    expect(matchesUrl('https://ya.ru/', ['*://ya.ru/*'])).toBe(true);
  });

  it('https://ya.ru/ does NOT match *://*.ya.ru/* (subdomain pattern excludes apex)', () => {
    expect(matchesUrl('https://ya.ru/', ['*://*.ya.ru/*'])).toBe(false);
  });

  it('https://mail.ya.ru/foo matches *://*.ya.ru/*', () => {
    expect(matchesUrl('https://mail.ya.ru/foo', ['*://*.ya.ru/*'])).toBe(true);
  });

  it('http://ya.ru/x matches *://ya.ru/*', () => {
    expect(matchesUrl('http://ya.ru/x', ['*://ya.ru/*'])).toBe(true);
  });

  it('https://example.com/ matches neither ya.ru pattern', () => {
    expect(matchesUrl('https://example.com/', ['*://ya.ru/*', '*://*.ya.ru/*'])).toBe(false);
  });

  it('apex+subdomain combined patterns cover both', () => {
    const patterns = ['*://ya.ru/*', '*://*.ya.ru/*'];
    expect(matchesUrl('https://ya.ru/', patterns)).toBe(true);
    expect(matchesUrl('https://mail.ya.ru/inbox', patterns)).toBe(true);
  });

  it('explicit scheme http does not match https URL', () => {
    expect(matchesUrl('https://ya.ru/', ['http://ya.ru/*'])).toBe(false);
  });

  it('returns false for malformed URL', () => {
    expect(matchesUrl('not-a-url', ['*://ya.ru/*'])).toBe(false);
  });

  it('path wildcard supports query strings via glob', () => {
    expect(matchesUrl('https://ya.ru/yandsearch?text=foo', ['*://ya.ru/*'])).toBe(true);
  });

  it('exact path glob can be more specific', () => {
    expect(matchesUrl('https://ya.ru/yandsearch', ['*://ya.ru/yandsearch*'])).toBe(true);
    expect(matchesUrl('https://ya.ru/maps', ['*://ya.ru/yandsearch*'])).toBe(false);
  });
});

describe('matchesScope (Chrome match-patterns with regex fallback)', () => {
  it('uses regex fallback against the full URL when match patterns miss', () => {
    expect(
      matchesScope('https://example.com/search?q=phase-3', {
        match: ['*://ya.ru/*'],
        regex: ['^https://example\\.com/search\\?q=phase-3$'],
      }),
    ).toBe(true);
  });

  it('gives match patterns precedence over invalid regex fallback', () => {
    expect(
      matchesScope('https://ya.ru/', {
        match: ['*://ya.ru/*'],
        regex: ['[invalid'],
      }),
    ).toBe(true);
  });

  it('returns false instead of throwing for invalid regex fallback', () => {
    expect(
      matchesScope('https://example.com/', {
        match: ['*://ya.ru/*'],
        regex: ['[invalid'],
      }),
    ).toBe(false);
  });

  it('returns false when neither match patterns nor regex match', () => {
    expect(
      matchesScope('https://example.com/', {
        match: ['*://ya.ru/*'],
        regex: ['^https://mail\\.ya\\.ru/'],
      }),
    ).toBe(false);
  });
});
