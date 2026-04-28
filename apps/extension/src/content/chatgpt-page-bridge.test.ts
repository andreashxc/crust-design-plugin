// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupChatGptAnswer,
  hasPrefilledPrompt,
  pickBestAssistantText,
  runPromptFlow,
} from './chatgpt-page-bridge';

describe('chatgpt-page-bridge pure helpers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('detects an already prefilled composer', () => {
    const composer = document.createElement('div');
    composer.textContent = 'Rewrite this product query';

    expect(hasPrefilledPrompt(composer, 'Rewrite   this product query')).toBe(true);
    expect(hasPrefilledPrompt(composer, 'Different prompt')).toBe(false);
  });

  it('picks the newest assistant text instead of the previous answer', () => {
    expect(pickBestAssistantText('old answer', 'new answer', 'old answer')).toBe('new answer');
    expect(pickBestAssistantText('new answer', 'old answer', 'old answer')).toBe('new answer');
  });

  it('cleans surrounding quotes and collapses whitespace', () => {
    expect(cleanupChatGptAnswer(' " hello\n\n world " ')).toBe('hello world');
    expect(cleanupChatGptAnswer('«hello   world»')).toBe('hello world');
  });

  it('times out when the ChatGPT composer is missing', async () => {
    vi.useFakeTimers();
    const promise = runPromptFlow('hello');
    const expectation = expect(promise).rejects.toThrow(
      'Timed out waiting for ChatGPT page element.',
    );

    await vi.advanceTimersByTimeAsync(20_500);

    await expectation;
  });
});
