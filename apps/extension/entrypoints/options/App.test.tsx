// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChromeMock } from '@/test-setup/chrome-mock';
import { App } from './App';

function chromeMock(): ChromeMock {
  return (globalThis as unknown as { chrome: ChromeMock }).chrome;
}

function buttonAt(name: string, index: number): HTMLElement {
  const button = screen.getAllByRole('button', { name })[index];
  if (!button) throw new Error(`Missing ${name} button at index ${index}`);
  return button;
}

async function renderOptions() {
  render(<App />);
  await screen.findByText('LLM providers and safety settings');
}

describe('options App', () => {
  beforeEach(() => {
    chromeMock().storage.local._data['llm:settings'] = {
      providerKeys: {},
      defaultProvider: 'openai',
      models: { openai: 'gpt-5', anthropic: 'claude-sonnet-4-5' },
      costGuard: {
        cacheEnabled: true,
        cacheTtlMs: 600000,
        maxAttempts: 3,
        maxOutputTokens: 512,
        warningCallsPerSession: 10,
        applyRateLimitMs: 1000,
      },
    };
    chromeMock().storage.session._data['llm:session'] = {
      calls: 3,
      cacheHits: 1,
      inputTokens: 20,
      outputTokens: 40,
      totalTokens: 60,
      startedAt: 1,
      updatedAt: 2,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('toggles API key masking for a provider input', async () => {
    await renderOptions();

    const input = screen.getByLabelText('OpenAI API key') as HTMLInputElement;
    const showButton = screen.getByRole('button', { name: 'Show OpenAI API key' });

    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'sk-test' } });
    fireEvent.click(showButton);

    expect(input.type).toBe('text');
    expect(
      screen.getByRole('button', { name: 'Hide OpenAI API key' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('saves and clears provider keys through storage', async () => {
    await renderOptions();

    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: '  sk-live  ' },
    });
    fireEvent.click(buttonAt('Save', 0));

    await waitFor(() => {
      expect(
        (
          chromeMock().storage.local._data['llm:settings'] as {
            providerKeys: Record<string, string>;
          }
        ).providerKeys.openai,
      ).toBe('sk-live');
    });
    expect(screen.getByText('OpenAI key saved')).toBeTruthy();

    fireEvent.click(buttonAt('Clear', 0));

    await waitFor(() => {
      expect(
        (
          chromeMock().storage.local._data['llm:settings'] as {
            providerKeys: Record<string, string>;
          }
        ).providerKeys.openai,
      ).toBeUndefined();
    });
    expect(screen.getByText('OpenAI key cleared')).toBeTruthy();
  });

  it('warns when the selected default provider has no saved key', async () => {
    await renderOptions();

    expect(screen.getByText('Default provider key is missing.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Anthropic API key'), {
      target: { value: 'anthropic-key' },
    });
    fireEvent.click(buttonAt('Save', 1));

    await waitFor(() => {
      expect(screen.getByText('Anthropic key saved')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Default provider'), { target: { value: 'anthropic' } });

    expect(screen.queryByText('Default provider key is missing.')).toBeNull();
  });

  it('persists model settings from the defaults section', async () => {
    await renderOptions();

    fireEvent.change(screen.getByLabelText('OpenAI model'), {
      target: { value: 'gpt-5.4-mini' },
    });
    fireEvent.blur(screen.getByLabelText('OpenAI model'));

    await waitFor(() => {
      expect(
        (
          chromeMock().storage.local._data['llm:settings'] as {
            models: Record<string, string>;
          }
        ).models.openai,
      ).toBe('gpt-5.4-mini');
    });
    expect(screen.getByText('Model settings saved')).toBeTruthy();
  });

  it('does not persist invalid cost guard values', async () => {
    await renderOptions();

    fireEvent.change(screen.getByRole('textbox', { name: 'Max attempts' }), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save cost guard' }));

    await waitFor(() => {
      expect(screen.getByText(/Enter whole numbers/)).toBeTruthy();
    });
    expect(
      (
        chromeMock().storage.local._data['llm:settings'] as {
          costGuard: { maxAttempts: number };
        }
      ).costGuard.maxAttempts,
    ).toBe(3);
  });

  it('clears diagnostics cache, resets session counters, and clears the last error', async () => {
    chromeMock().storage.local._data['llm:cache:test'] = { text: 'cached' };
    chromeMock().storage.local._data['llm:last_error'] = {
      provider: 'openai',
      message: 'quota exceeded',
      at: 10,
    };

    await renderOptions();

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/quota exceeded/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear cache' }));
    await waitFor(() => {
      expect(chromeMock().storage.local._data['llm:cache:test']).toBeUndefined();
      expect(screen.getByText('LLM cache cleared')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset session' }));
    await waitFor(() => {
      expect((chromeMock().storage.session._data['llm:session'] as { calls: number }).calls).toBe(
        0,
      );
      expect(screen.getByText('Session counters reset')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear error' }));
    await waitFor(() => {
      expect(chromeMock().storage.local._data['llm:last_error']).toBeUndefined();
      expect(screen.getByText('Last LLM error cleared')).toBeTruthy();
    });
  });
});
