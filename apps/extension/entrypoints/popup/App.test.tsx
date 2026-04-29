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

function resetStore(entryOrRegistry: RegistryEntry | RegistryEntry[] = makeEntry()) {
  const registry = Array.isArray(entryOrRegistry) ? entryOrRegistry : [entryOrRegistry];
  useStore.setState({
    registry,
    enabled: {},
    autodisabled: {},
    lastError: {},
    tweakValues: {},
    tweakErrors: {},
    llmSession: null,
    publicLlmConfig: null,
    lastLlmError: undefined,
    experimentOrder: [],
    authorGroupOrder: [],
    authorGroupOpen: {},
    updateState: null,
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

  it('renders one author group open by default', () => {
    render(<App />);
    expect(screen.getByText('Crust')).toBeTruthy();
    expect(screen.getByText('andrew')).toBeTruthy();
    expect(screen.getByText('Smoke pink')).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Toggle Smoke pink' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('renders multiple author groups collapsed by default and persists opened groups', async () => {
    resetStore([
      makeEntry({ id: 'A', author: 'andrew', name: 'Andrew demo' }),
      makeEntry({ id: 'B', author: 'beth', name: 'Beth demo' }),
    ]);

    render(<App />);

    expect(screen.getByText('andrew')).toBeTruthy();
    expect(screen.getByText('beth')).toBeTruthy();
    expect(screen.queryByText('Andrew demo')).toBeNull();
    expect(screen.queryByText('Beth demo')).toBeNull();

    fireEvent.click(screen.getByText('andrew'));

    await waitFor(() => {
      expect(screen.getByText('Andrew demo')).toBeTruthy();
      expect(chromeMock().storage.local.set).toHaveBeenCalledWith({
        'popup:author_group_open': { andrew: true },
      });
    });
  });

  it('restores persisted author group expansion state', () => {
    resetStore([
      makeEntry({ id: 'A', author: 'andrew', name: 'Andrew demo' }),
      makeEntry({ id: 'B', author: 'beth', name: 'Beth demo' }),
    ]);
    useStore.setState({ authorGroupOpen: { andrew: true, beth: false } });

    render(<App />);

    expect(screen.getByText('Andrew demo')).toBeTruthy();
    expect(screen.queryByText('Beth demo')).toBeNull();
  });

  it('renders author groups in persisted order', () => {
    resetStore([
      makeEntry({ id: 'A', author: 'andrew', name: 'Andrew demo' }),
      makeEntry({ id: 'B', author: 'beth', name: 'Beth demo' }),
    ]);
    useStore.setState({ authorGroupOrder: ['beth', 'andrew'] });

    render(<App />);

    expect(screen.getAllByText(/^(andrew|beth)$/).map((node) => node.textContent)).toEqual([
      'beth',
      'andrew',
    ]);
  });

  it('persists author group drag reorder', async () => {
    resetStore([
      makeEntry({ id: 'A', author: 'andrew', name: 'Andrew demo' }),
      makeEntry({ id: 'B', author: 'beth', name: 'Beth demo' }),
    ]);
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: (type: string, value: string) => transfer.set(type, value),
      getData: (type: string) => transfer.get(type) ?? '',
    };

    render(<App />);
    const source = screen.getByText('andrew').closest('[draggable="true"]');
    const target = screen.getByText('beth').closest('[draggable="true"]');
    if (!source || !target) throw new Error('Expected draggable author groups');
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => {
      expect(chromeMock().storage.local.set).toHaveBeenCalledWith({
        'popup:author_group_order': ['beth', 'andrew'],
      });
    });
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

  it('hides search by default and opens it from the header button', () => {
    render(<App />);

    expect(screen.queryByRole('textbox', { name: 'Search experiments' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show search' }));

    expect(screen.getByRole('textbox', { name: 'Search experiments' })).toBeTruthy();
  });

  it('filters experiments by search text after scope filtering', () => {
    resetStore([
      makeEntry({ name: 'Helper demo', description: 'Phase helpers' }),
      makeEntry({
        id: '01J0BBBBBBBBBBBBBBBBBBBBBB',
        folder: 'smoke-two',
        name: 'Smoke pink',
        description: 'Turns ya.ru pink',
      }),
    ]);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show search' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search experiments' }), {
      target: { value: 'helper' },
    });

    expect(screen.getByText('Helper demo')).toBeTruthy();
    expect(screen.queryByText('Smoke pink')).toBeNull();
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
    expect(screen.getByText('No experiments match this page.')).toBeTruthy();
  });

  it('renders distinct empty, scope, and search guidance', () => {
    useStore.setState({ registry: [], bootstrapped: true });
    const { rerender } = render(<App />);
    expect(screen.getByText(/corepack pnpm dev/)).toBeTruthy();

    resetStore(makeEntry());
    useStore.setState({ activeTabUrl: 'https://example.com/' });
    rerender(<App />);
    expect(screen.getByText('No experiments match this page.')).toBeTruthy();

    resetStore(makeEntry({ name: 'Smoke pink' }));
    rerender(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show search' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search experiments' }), {
      target: { value: 'nothing' },
    });
    expect(screen.getByText('No experiments match this search.')).toBeTruthy();
  });

  it('shows actionable update banner only for available updates', () => {
    useStore.setState({
      updateState: {
        currentVersion: '0.0.0',
        currentCommit: 'abc',
        remoteCommit: 'def',
        available: true,
        checkedAt: 1,
        url: 'https://github.com/andreashxc/crust-design-plugin/compare/abc...main',
      },
    });

    const { rerender } = render(<App />);
    expect(screen.getByText('Update available')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(chromeMock().tabs.create).toHaveBeenCalledWith({
      url: 'https://github.com/andreashxc/crust-design-plugin/compare/abc...main',
    });

    useStore.setState({
      updateState: {
        currentVersion: '0.0.0',
        currentCommit: 'abc',
        available: false,
        checkedAt: 2,
        error: 'offline',
      },
    });
    rerender(<App />);
    expect(screen.queryByText('Update available')).toBeNull();
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

  it('persists drag reorder', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    resetStore([
      makeEntry({ id: 'A', name: 'Tweak demo' }),
      makeEntry({ id: 'B', name: 'Smoke pink' }),
    ]);
    useStore.setState({ experimentOrder: ['A', 'B'] });
    const transfer = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'move',
      setData: (type: string, value: string) => transfer.set(type, value),
      getData: (type: string) => transfer.get(type) ?? '',
    };

    render(<App />);
    const source = screen.getByText('Tweak demo').closest('[draggable="true"]');
    const target = screen.getByText('Smoke pink').closest('[draggable="true"]');
    if (!source || !target) throw new Error('Expected draggable rows');
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await waitFor(() => {
      expect(chromeMock().storage.local.set).toHaveBeenCalledWith({ experiment_order: ['B', 'A'] });
    });
  });

  it('opens source folder in Cursor when sourceDir exists', async () => {
    resetStore(makeEntry({ sourceDir: '/tmp/crust/experiments/andrew/smoke' }));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Smoke pink in Cursor' }));

    await waitFor(() => {
      expect(chromeMock().tabs.create).toHaveBeenCalledWith({
        url: 'cursor://file//tmp/crust/experiments/andrew/smoke',
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

  it('loads a valid tweak preset and broadcasts TWEAKS_CHANGED', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
        presets: [
          {
            name: 'Compact',
            path: 'experiments/andrew/smoke/presets/compact.json',
            values: { headline: 'Short' },
          },
        ],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Hello' } },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Load preset' }), {
      target: { value: 'Compact' },
    });

    await waitFor(() => {
      expect(chromeMock().storage.local.set).toHaveBeenCalledWith({
        'tweaks:01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Short' },
      });
      expect(chromeMock().runtime.sendMessage).toHaveBeenCalledWith({
        name: 'TWEAKS_CHANGED',
        data: { id: '01J0AAAAAAAAAAAAAAAAAAAAAA' },
      });
    });
  });

  it('shows invalid preset errors without broadcasting TWEAKS_CHANGED', async () => {
    chromeMock().runtime.sendMessage.mockResolvedValue({ ok: true });
    resetStore(
      makeEntry({
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
        presets: [
          {
            name: 'Broken',
            path: 'experiments/andrew/smoke/presets/broken.json',
            values: { headline: 12 },
          },
        ],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Hello' } },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Load preset' }), {
      target: { value: 'Broken' },
    });

    await waitFor(() => {
      expect(screen.getByText('Preset "Broken" is invalid')).toBeTruthy();
    });
    expect(chromeMock().runtime.sendMessage).not.toHaveBeenCalledWith({
      name: 'TWEAKS_CHANGED',
      data: { id: '01J0AAAAAAAAAAAAAAAAAAAAAA' },
    });
  });

  it('copies a truthful CLI preset save command', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    resetStore(
      makeEntry({
        author: 'andrew',
        folder: 'smoke',
        tweaks: [{ type: 'text', key: 'headline', label: 'Headline', default: 'Hello' }],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { headline: 'Hello' } },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Preset name' }), {
      target: { value: 'Compact' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Copy command/ }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "corepack pnpm save-preset 'andrew/smoke' 'Compact' '{\"headline\":\"Hello\"}'",
      );
    });
    expect(screen.getByText('Save command copied')).toBeTruthy();
  });

  it('copies stored debug output from an enabled debug tweak row', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    chromeMock().storage.local._data['debug_output:01J0AAAAAAAAAAAAAAAAAAAAAA'] =
      '{"status":"Debug ready"}';
    resetStore(
      makeEntry({
        tweaks: [{ type: 'toggle', key: 'debug_mode', label: 'Debug mode', default: false }],
      }),
    );
    useStore.setState({
      enabled: { '01J0AAAAAAAAAAAAAAAAAAAAAA': true },
      tweakValues: { '01J0AAAAAAAAAAAAAAAAAAAAAA': { debug_mode: true } },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy debug output for Smoke pink' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('{"status":"Debug ready"}');
    });
    expect(
      screen
        .getByRole('button', { name: 'Copy debug output for Smoke pink' })
        .getAttribute('title'),
    ).toBe('Debug copied');
  });

  it('copies a truthful CLI fork command', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    resetStore(makeEntry({ author: 'andrew', folder: 'smoke', name: 'Smoke pink' }));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy fork command for Smoke pink' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "corepack pnpm fork-experiment 'andrew/smoke' '<your-author>'",
      );
    });
    expect(screen.getByText('Fork command copied')).toBeTruthy();
  });

  it('surfaces stale description status without blocking the row', () => {
    resetStore(makeEntry({ descriptionStatus: 'stale' }));

    render(<App />);

    expect(screen.getByText('Description stale')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Toggle Smoke pink' })).toBeTruthy();
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
