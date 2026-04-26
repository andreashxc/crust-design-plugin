/**
 * Compile-only test: verifies ProtocolMap shape via expectTypeOf.
 * Runtime body is intentionally trivial — failure mode is `tsc --noEmit`.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { ProtocolMap } from './messages';

describe('ProtocolMap (D-05)', () => {
  it('EXPERIMENT_TOGGLE has typed args + result', () => {
    expectTypeOf<Parameters<ProtocolMap['EXPERIMENT_TOGGLE']>[0]>().toEqualTypeOf<{
      id: string;
      enabled: boolean;
    }>();
    expectTypeOf<ReturnType<ProtocolMap['EXPERIMENT_TOGGLE']>>().toEqualTypeOf<
      { ok: true } | { ok: false; error: string }
    >();
  });

  it('STATE_CHANGED carries {tabId} payload (RESEARCH R8)', () => {
    expectTypeOf<Parameters<ProtocolMap['STATE_CHANGED']>[0]>().toEqualTypeOf<{
      tabId: number;
    }>();
    expectTypeOf<ReturnType<ProtocolMap['STATE_CHANGED']>>().toEqualTypeOf<void>();
  });

  it('APPLIED_COUNT_CHANGED carries per-tab badge count payload', () => {
    expectTypeOf<Parameters<ProtocolMap['APPLIED_COUNT_CHANGED']>[0]>().toEqualTypeOf<{
      tabId: number;
      count: number;
    }>();
    expectTypeOf<ReturnType<ProtocolMap['APPLIED_COUNT_CHANGED']>>().toEqualTypeOf<{ ok: true }>();
  });

  it('EXPERIMENT_ERROR has typed args + result', () => {
    expectTypeOf<Parameters<ProtocolMap['EXPERIMENT_ERROR']>[0]>().toMatchTypeOf<{
      id: string;
      phase: 'apply' | 'cleanup';
      message: string;
      stack?: string;
    }>();
    expectTypeOf<ReturnType<ProtocolMap['EXPERIMENT_ERROR']>>().toEqualTypeOf<{ ok: true }>();
  });

  it('STATUS_QUERY returns map of id → ExperimentStatus', () => {
    expectTypeOf<Parameters<ProtocolMap['STATUS_QUERY']>>().toEqualTypeOf<[]>();
    expectTypeOf<ReturnType<ProtocolMap['STATUS_QUERY']>>().toMatchTypeOf<
      Record<string, 'disabled' | 'pending' | 'applied' | 'error' | 'auto-disabled'>
    >();
  });

  it('WHO_AM_I has no payload and returns {tabId: number} (Blocker 2 fix)', () => {
    expectTypeOf<Parameters<ProtocolMap['WHO_AM_I']>>().toEqualTypeOf<[]>();
    expectTypeOf<ReturnType<ProtocolMap['WHO_AM_I']>>().toEqualTypeOf<{ tabId: number }>();
  });

  it('Phase 4 helper messages are typed', () => {
    expectTypeOf<Parameters<ProtocolMap['LLM_COMPLETE']>[0]>().toMatchTypeOf<{
      experimentId: string;
      prompt: string;
    }>();
    expectTypeOf<ReturnType<ProtocolMap['LLM_COMPLETE']>>().toMatchTypeOf<{
      text: string;
      provider: 'openai' | 'anthropic';
      model: string;
      cached: boolean;
    }>();
    expectTypeOf<Parameters<ProtocolMap['FETCH_PAGE']>[0]>().toEqualTypeOf<{
      url: string;
      selector?: string;
    }>();
  });

  it('ICON_THEME_CHANGED carries a light/dark theme', () => {
    expectTypeOf<Parameters<ProtocolMap['ICON_THEME_CHANGED']>[0]>().toEqualTypeOf<{
      theme: 'light' | 'dark';
    }>();
    expectTypeOf<ReturnType<ProtocolMap['ICON_THEME_CHANGED']>>().toEqualTypeOf<{ ok: true }>();
  });
});
