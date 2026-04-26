import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// ===== Phase 2 type-export compile assertion (MAN-04) =====
// If any of these imports fails, the SDK is missing a Phase 2 export.
import type {
  AutoDisableRecord,
  ErrorRecord,
  ExperimentStatus,
  FetchPageResult,
  Helpers,
  LlmOptions,
  LlmProvider,
  LlmResult,
  LlmUsage,
  Registry,
  RegistryEntry,
  TweakDefinition,
  TweakValueMap,
} from './index';
import {
  defaultTweakValues,
  ExperimentManifest,
  mergeTweakValues,
  TweakValueValidationError,
  validateTweakValues,
} from './index';

// Type-level "is the type non-never" check — the assignments must compile.
const _statusOk: ExperimentStatus = 'applied';
const _errOk: ErrorRecord = { phase: 'apply', message: '', at: 0 };
const _autoOk: AutoDisableRecord = { reason: '', count: 0, firstAt: 0, lastAt: 0 };
// RegistryEntry literal MUST include `folder` (Warning 6 fix from checker
// iteration 1) — content scripts use entry.folder for loader resolution
// instead of regex-parsing chunkPath.
const _entryOk: RegistryEntry = {
  id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
  author: 'a',
  folder: 'a',
  name: 'a',
  description: 'a',
  scope: { match: ['*://ya.ru/*'] },
  world: 'isolated',
  chunkPath: '',
  tweaks: [],
};
const _registryOk: Registry = [_entryOk];
const _tweakOk: TweakDefinition = {
  type: 'toggle',
  key: 'enabled',
  label: 'Enabled',
  default: true,
};
const _tweakValuesOk: TweakValueMap = { enabled: true };
const _providerOk: LlmProvider = 'openai';
const _usageOk: LlmUsage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
const _llmOptionsOk: LlmOptions = { provider: 'anthropic', maxOutputTokens: 128 };
const _llmResultOk: LlmResult = {
  text: 'hello',
  provider: 'openai',
  model: 'gpt-test',
  cached: false,
  usage: _usageOk,
};
const _fetchPageOk: FetchPageResult = {
  ok: false,
  url: 'https://ya.ru/',
  reason: 'likely_spa_shell',
  message: 'SPA shell',
};
const _helpersOk: Helpers = {
  log: () => {},
  llm: async () => 'hello',
  fetchPage: async () => _fetchPageOk,
  injectStyle: () => document.createElement('style'),
  injectNode: (node) => node,
  waitFor: async () => document.createElement('div'),
  onUrlChange: () => () => {},
};

// Suppress unused-var warnings — these are compile checks, not runtime.
void _statusOk;
void _errOk;
void _autoOk;
void _entryOk;
void _registryOk;
void _tweakOk;
void _tweakValuesOk;
void _providerOk;
void _usageOk;
void _llmOptionsOk;
void _llmResultOk;
void _fetchPageOk;
void _helpersOk;

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

    it('accepts all six typed tweak definitions', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [
          { type: 'toggle', key: 'enabled', label: 'Enabled', default: true },
          {
            type: 'select',
            key: 'density',
            label: 'Density',
            options: ['compact', 'comfortable'],
            default: 'compact',
          },
          { type: 'text', key: 'headline', label: 'Headline', default: 'Hello' },
          {
            type: 'number-slider',
            key: 'scale',
            label: 'Scale',
            min: 0,
            max: 10,
            step: 1,
            default: 5,
          },
          { type: 'color', key: 'accent', label: 'Accent', default: '#12aBef' },
          {
            type: 'multi-select',
            key: 'sections',
            label: 'Sections',
            options: ['news', 'sports', 'finance'],
            default: ['news', 'finance'],
          },
        ],
      };

      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tweaks).toHaveLength(6);
      }
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

    it('rejects select default not in options', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [
          {
            type: 'select',
            key: 'density',
            label: 'Density',
            options: ['compact', 'comfortable'],
            default: 'wide',
          },
        ],
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'tweaks.0.default')).toBe(true);
      }
    });

    it('rejects multi-select default values not in options', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [
          {
            type: 'multi-select',
            key: 'sections',
            label: 'Sections',
            options: ['news', 'sports'],
            default: ['news', 'finance'],
          },
        ],
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'tweaks.0.default')).toBe(true);
      }
    });

    it('rejects number-slider default outside range', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [
          {
            type: 'number-slider',
            key: 'scale',
            label: 'Scale',
            min: 0,
            max: 10,
            default: 11,
          },
        ],
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'tweaks.0.default')).toBe(true);
      }
    });

    it('rejects invalid color defaults', () => {
      const input = {
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [{ type: 'color', key: 'accent', label: 'Accent', default: 'blue' }],
      };
      const result = ExperimentManifest.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.join('.') === 'tweaks.0.default')).toBe(true);
      }
    });

    it('rejects empty and invalid tweak keys', () => {
      const emptyKey = ExperimentManifest.safeParse({
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [{ type: 'toggle', key: '', label: 'Enabled', default: true }],
      });
      expect(emptyKey.success).toBe(false);

      const invalidKey = ExperimentManifest.safeParse({
        ...(loadFixture('valid.json') as Record<string, unknown>),
        tweaks: [{ type: 'toggle', key: 'bad key', label: 'Enabled', default: true }],
      });
      expect(invalidKey.success).toBe(false);
    });
  });
});

describe('tweak value helpers', () => {
  const tweaks: TweakDefinition[] = [
    { type: 'toggle', key: 'enabled', label: 'Enabled', default: true },
    {
      type: 'select',
      key: 'density',
      label: 'Density',
      options: ['compact', 'comfortable'],
      default: 'compact',
    },
    { type: 'text', key: 'headline', label: 'Headline', default: 'Hello' },
    {
      type: 'number-slider',
      key: 'scale',
      label: 'Scale',
      min: 0,
      max: 10,
      default: 5,
    },
    { type: 'color', key: 'accent', label: 'Accent', default: '#123456' },
    {
      type: 'multi-select',
      key: 'sections',
      label: 'Sections',
      options: ['news', 'sports', 'finance'],
      default: ['news'],
    },
  ];

  it('builds default value maps from tweak definitions', () => {
    expect(defaultTweakValues(tweaks)).toEqual({
      enabled: true,
      density: 'compact',
      headline: 'Hello',
      scale: 5,
      accent: '#123456',
      sections: ['news'],
    });
  });

  it('validates provided tweak values and fills omitted values with defaults', () => {
    expect(
      validateTweakValues(tweaks, {
        enabled: false,
        density: 'comfortable',
        headline: 'Hi',
        scale: 7,
        accent: '#abcdef',
        sections: ['sports', 'finance'],
      }),
    ).toEqual({
      enabled: false,
      density: 'comfortable',
      headline: 'Hi',
      scale: 7,
      accent: '#abcdef',
      sections: ['sports', 'finance'],
    });

    expect(validateTweakValues(tweaks, { headline: 'Only override' })).toEqual({
      enabled: true,
      density: 'compact',
      headline: 'Only override',
      scale: 5,
      accent: '#123456',
      sections: ['news'],
    });
  });

  it('throws TweakValidationError for invalid provided values', () => {
    expect(() => validateTweakValues(tweaks, { scale: 11 })).toThrow(TweakValueValidationError);
    expect(() => validateTweakValues(tweaks, { sections: ['unknown'] })).toThrow(
      TweakValueValidationError,
    );
    expect(() => validateTweakValues(tweaks, { extra: true })).toThrow(TweakValueValidationError);
  });

  it('merges stored values and keeps defaults for invalid or unknown stored values', () => {
    expect(
      mergeTweakValues(tweaks, {
        enabled: false,
        density: 'unknown',
        headline: 'Stored',
        scale: 12,
        accent: '#654321',
        sections: ['sports'],
        extra: true,
      }),
    ).toEqual({
      enabled: false,
      density: 'compact',
      headline: 'Stored',
      scale: 5,
      accent: '#654321',
      sections: ['sports'],
    });
  });
});
