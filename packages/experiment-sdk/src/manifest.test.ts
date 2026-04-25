import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ExperimentManifest } from './index';

const __dirname = dirname(fileURLToPath(import.meta.url));
// From packages/experiment-sdk/src/ → tests/fixtures/manifests/ at repo root
const FIXTURES = resolve(__dirname, '../../../tests/fixtures/manifests');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));
}

describe('ExperimentManifest schema (D-16)', () => {
  describe('valid input', () => {
    it('accepts the canonical valid fixture', () => {
      const result = ExperimentManifest.safeParse(loadFixture('valid.json'));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('01J0ABCDEFGHJKMNPQRSTVWXYZ');
        expect(result.data.world).toBe('isolated');
        expect(result.data.tweaks).toEqual([]);
      }
    });

    it('defaults `world` to "isolated" when omitted', () => {
      const input = { ...(loadFixture('valid.json') as Record<string, unknown>) };
      delete input.world;
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.world).toBe('isolated');
    });

    it('defaults `tweaks` to [] when omitted', () => {
      const input = { ...(loadFixture('valid.json') as Record<string, unknown>) };
      delete input.tweaks;
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.tweaks).toEqual([]);
    });

    it('accepts optional `scope.regex` when provided', () => {
      const input = loadFixture('valid.json') as {
        scope: { match: string[]; regex?: string[] };
      };
      input.scope.regex = ['^https://ya\\.ru/.*$'];
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid input', () => {
    it('rejects empty `id`', () => {
      const result = ExperimentManifest.safeParse(loadFixture('missing-id.json'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'id')).toBe(true);
      }
    });

    it('rejects `world: "iso"` (not in enum)', () => {
      const result = ExperimentManifest.safeParse(loadFixture('bad-world.json'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'world')).toBe(true);
      }
    });

    it('rejects empty `scope.match`', () => {
      const result = ExperimentManifest.safeParse(loadFixture('empty-match.json'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'scope.match')).toBe(true);
      }
    });

    it('rejects `description` longer than 280 characters', () => {
      const result = ExperimentManifest.safeParse(loadFixture('over-280-description.json'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'description')).toBe(true);
      }
    });

    it('rejects lowercase ULID', () => {
      const result = ExperimentManifest.safeParse(loadFixture('lowercase-ulid.json'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'id')).toBe(true);
      }
    });

    it('rejects ULID containing forbidden Crockford characters (I/L/O/U)', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        id: '01J0ILOU1111111111111111AB',
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects ULID of wrong length', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        id: '01J0',
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects empty `name`', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        name: '',
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'name')).toBe(true);
      }
    });

    it('rejects empty `author`', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        author: '',
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'author')).toBe(true);
      }
    });

    it('rejects missing `scope`', () => {
      const input = { ...(loadFixture('valid.json') as Record<string, unknown>) };
      delete input.scope;
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
