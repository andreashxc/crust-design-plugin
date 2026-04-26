import type { AutoDisableRecord, Registry, RegistryEntry } from '@platform/experiment-sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
    author: 'andrew',
    folder: 'smoke',
    name: 'Smoke',
    description: 'd',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    chunkPath: '',
    tweaks: [],
    ...overrides,
  };
}

describe('popup store (D-27)', () => {
  beforeEach(() => {
    useStore.setState({
      registry: [],
      enabled: {},
      autodisabled: {},
      lastError: {},
      tweakValues: {},
      tweakErrors: {},
      llmSession: null,
      publicLlmConfig: null,
      lastLlmError: undefined,
      experimentOrder: [],
      activeTabId: null,
      activeTabUrl: null,
      appliedInActiveTab: [],
      bootstrapped: false,
    });
  });

  it('default state has empty slices', () => {
    const state = useStore.getState();
    expect(state.registry).toEqual([]);
    expect(state.enabled).toEqual({});
    expect(state.autodisabled).toEqual({});
    expect(state.lastError).toEqual({});
    expect(state.tweakValues).toEqual({});
    expect(state.tweakErrors).toEqual({});
    expect(state.llmSession).toBeNull();
    expect(state.publicLlmConfig).toBeNull();
    expect(state.lastLlmError).toBeUndefined();
    expect(state.experimentOrder).toEqual([]);
    expect(state.activeTabId).toBeNull();
    expect(state.activeTabUrl).toBeNull();
    expect(state.appliedInActiveTab).toEqual([]);
    expect(state.bootstrapped).toBe(false);
  });

  it('setRegistry updates only the registry slice', () => {
    const registry: Registry = [makeEntry()];
    useStore.getState().setRegistry(registry);
    expect(useStore.getState().registry).toEqual(registry);
    expect(useStore.getState().enabled).toEqual({});
    expect(useStore.getState().autodisabled).toEqual({});
  });

  it('three slices compose without key collisions', () => {
    const autodisabled: Record<string, AutoDisableRecord> = {
      B: { reason: 'r', count: 3, firstAt: 0, lastAt: 1 },
    };

    useStore.getState().setRegistry([makeEntry()]);
    useStore.getState().setEnabled({ A: true });
    useStore.getState().setAutoDisabled(autodisabled);
    useStore.getState().setLastError({ C: { phase: 'apply', message: 'm', at: 2 } });
    useStore.getState().setTweakValues({ A: { enabled: true } });
    useStore.getState().setTweakErrors({ A: [{ message: 'bad value' }] });
    useStore.getState().setLlmSession({
      calls: 1,
      cacheHits: 0,
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
      startedAt: 1,
      updatedAt: 2,
    });
    useStore.getState().setPublicLlmConfig({
      defaultProvider: 'openai',
      models: { openai: 'gpt', anthropic: 'claude' },
      costGuard: {
        cacheEnabled: true,
        cacheTtlMs: 1,
        maxAttempts: 3,
        maxOutputTokens: 100,
        warningCallsPerSession: 10,
        applyRateLimitMs: 1000,
      },
      providers: { openai: { configured: true }, anthropic: { configured: false } },
    });
    useStore.getState().setLastLlmError({ experimentId: 'A', message: 'm', at: 3 });
    useStore.getState().setExperimentOrder(['B', 'A']);
    useStore.getState().setActiveTab(7);
    useStore.getState().setActiveTabUrl('https://ya.ru/path');
    useStore.getState().setAppliedInActiveTab(['A']);
    useStore.getState().setBootstrapped(true);

    const state = useStore.getState();
    expect(state.registry).toHaveLength(1);
    expect(state.enabled).toEqual({ A: true });
    expect(state.autodisabled).toEqual(autodisabled);
    expect(state.lastError.C?.message).toBe('m');
    expect(state.tweakValues.A).toEqual({ enabled: true });
    expect(state.tweakErrors.A?.[0]?.message).toBe('bad value');
    expect(state.llmSession?.totalTokens).toBe(5);
    expect(state.publicLlmConfig?.providers.openai.configured).toBe(true);
    expect(state.lastLlmError?.experimentId).toBe('A');
    expect(state.experimentOrder).toEqual(['B', 'A']);
    expect(state.activeTabId).toBe(7);
    expect(state.activeTabUrl).toBe('https://ya.ru/path');
    expect(state.appliedInActiveTab).toEqual(['A']);
    expect(state.bootstrapped).toBe(true);
  });

  it('useStore.setState(partial) is callable outside React', () => {
    useStore.setState({ enabled: { Z: true } });
    expect(useStore.getState().enabled).toEqual({ Z: true });
  });
});
