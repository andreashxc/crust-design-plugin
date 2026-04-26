// @vitest-environment jsdom

import type { RegistryEntry } from '@platform/experiment-sdk';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/popup/store';
import type { ChromeMock } from '@/test-setup/chrome-mock';
import { App } from './App';

function chromeMock(): ChromeMock {
  return (globalThis as unknown as { chrome: ChromeMock }).chrome;
}

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: '01J0AAAAAAAAAAAAAAAAAAAAAA',
    author: 'andrew',
    folder: 'smoke',
    name: 'Smoke pink',
    description: 'Turns ya.ru pink',
    scope: { match: ['*://ya.ru/*'] },
    world: 'isolated',
    chunkPath: 'chunks/experiments-andrew__smoke.js',
    tweaks: [],
    ...overrides,
  };
}

function resetStore(entry = makeEntry()) {
  useStore.setState({
    registry: [entry],
    enabled: {},
    autodisabled: {},
    lastError: {},
    tweakValues: {},
    tweakErrors: {},
    llmSession: null,
    publicLlmConfig: null,
    lastLlmError: undefined,
    activeTabId: 7,
    activeTabUrl: 'https://ya.ru/',
    appliedInActiveTab: [],
    bootstrapped: true,
  });
}

describe('popup App', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders author group and disabled row', () => {
    render(<App />);
    expect(screen.getByText('Crust')).toBeTruthy();
    expect(screen.getByText('andrew')).toBeTruthy();
    expect(screen.getByText('Smoke pink')).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Toggle Smoke pink' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('renders an enabled switch when the experiment is on', () => {
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      appliedInActiveTab: ['01J0AAAAAAAAAAAAAAAAAAAAAA'],
    });

    render(<App />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Toggle Smoke pink' }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('renders labelled LLM session calls and tokens in the header', () => {
    useStore.setState({
      llmSession: {
        calls: 2,
        cacheHits: 1,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        startedAt: 1,
        updatedAt: 2,
      },
    });

    render(<App />);

    expect(screen.getByText('LLM 2 calls · 30 tok')).toBeTruthy();
  });

  it('hides zero LLM session state', () => {
    useStore.setState({
      llmSession: {
        calls: 0,
        cacheHits: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        startedAt: 1,
        updatedAt: 2,
      },
    });

    render(<App />);

    expect(screen.queryByText('LLM 0 calls')).toBeNull();
    expect(screen.queryByText('0 / 0')).toBeNull();
  });

  it('opens global Crust options from the popup header', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Crust options' }));

    expect(chromeMock().runtime.openOptionsPage).toHaveBeenCalled();
  });

  it('reloads registry from the popup header', async () => {
    const nextEntry = makeEntry({
      id: '01J0BBBBBBBBBBBBBBBBBBBBBB',
      folder: 'new-demo',
      name: 'New demo',
    });
    const fetchMock = vi.fn(async () => ({
      json: async () => [nextEntry],
    }));
    vi.stubGlobal('fetch', fetchMock);
    chromeMock().tabs.query.mockResolvedValue([{ id: 7, url: 'https://ya.ru/' }]);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload experiments' }));

    await waitFor(() => {
      expect(screen.getByText('New demo')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('chrome-extension://test/registry.json');
  });

  it('shows only inline missing-key warning for the affected LLM experiment', () => {
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      publicLlmConfig: {
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
        providers: { openai: { configured: false }, anthropic: { configured: false } },
      },
      lastLlmError: {
        experimentId: '01J0AAAAAAAAAAAAAAAAAAAAAA',
        provider: 'openai',
        code: 'missing_api_key',
        message: 'Missing openai API key',
        at: 1,
      },
    });

    render(<App />);

    expect(screen.getByText('LLM key missing for openai')).toBeTruthy();
    expect(screen.queryByText(/LLM not configured/i)).toBeNull();
  });

  it('filters out experiments outside the active tab scope', () => {
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      activeTabUrl: 'https://example.com/',
    });

    render(<App />);
    expect(screen.queryByText('Smoke pink')).toBeNull();
    expect(screen.getByText('No experiments match this page')).toBeTruthy();
  });

  it('renders auto-disabled banner and expandable stack trace', () => {
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      autodisabled: {
        '01J0AAAAAAAAAAAAAAAAAAAAAA': {
          reason: 'test',
          count: 3,
          firstAt: 0,
          lastAt: 1,
        },
      },
      lastError: {
        '01J0AAAAAAAAAAAAAAAAAAAAAA': {
          phase: 'apply',
          message: 'Error: test trip',
          stack: 'Error: test trip\n    at apply',
          at: 1,
        },
      },
    });

    render(<App />);
    expect(screen.getByText(/Disabled after 3 errors in 10s/)).toBeTruthy();
    fireEvent.click(screen.getByText('Show stack trace'));
    expect(screen.getByText(/at apply/)).toBeTruthy();
  });

  it('dispatches EXPERIMENT_TOGGLE when switch changes', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    render(<App />);

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle Smoke pink' }));

    await waitFor(() => {
      expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
        name: 'EXPERIMENT_TOGGLE',
        data: { id: '01J0AAAAAAAAAAAAAAAAAAAAAA', enabled: true },
      });
    });
  });

  it('persists tweak changes and broadcasts TWEAKS_CHANGED', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Hello' } },
    });
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Headline' }), {
      target: { value: 'Updated' },
    });

    await waitFor(() => {
      expect(chromeMock().storage.local.set).toHaveBeenCalledWith({
        'tweaks:01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Updated' },
      });
      expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
        name: 'TWEAKS_CHANGED',
        data: { id: '01J0AAAAAAAAAAAAAAAAAAAAAA' },
      });
      expect(chromeMock().tabs.sendMessage).toHaveBeenCalledWith(7, {
        name: 'TWEAKS_CHANGED',
        data: { id: '01J0AAAAAAAAAAAAAAAAAAAAAA' },
      });
    });
  });

  it('hides tweak controls while the experiment is disabled', () => {
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
      }),
    );

    render(<App />);

    expect(screen.queryByRole('textbox', { name: 'Headline' })).toBeNull();
    expect(screen.queryByRole('button', { name: /tweaks for Smoke pink/ })).toBeNull();
  });

  it('does not open tweaks automatically when enabling an experiment', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('switch', { name: 'Toggle Smoke pink' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand tweaks for Smoke pink' })).toBeTruthy();
    });
    expect(screen.queryByRole('textbox', { name: 'Headline' })).toBeNull();
  });

  it('opens tweaks by default when enabled and lets the user collapse them', () => {
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Hello' } },
    });

    render(<App />);

    expect(screen.getByRole('textbox', { name: 'Headline' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse tweaks for Smoke pink' }));
    expect(screen.queryByRole('textbox', { name: 'Headline' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand tweaks for Smoke pink' }));
    expect(screen.getByRole('textbox', { name: 'Headline' })).toBeTruthy();
  });

  it('renders empty state after bootstrap with empty registry', () => {
    useStore.setState({ registry: [], bootstrapped: true });
    render(<App />);
    expect(screen.getByText(/No experiments yet/)).toBeTruthy();
  });
});
