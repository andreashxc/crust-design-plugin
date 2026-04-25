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
});
