import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLastLlmError,
  getLlmSessionStats,
  setLlmDefaults,
  setProviderKey,
} from '@/shared/storage';
import { completeLlm, testProvider } from './service';

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('LLM service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('throws a structured missing-key error without calling fetch', async () => {
    await expect(completeLlm({ experimentId: 'exp', prompt: 'hello' })).rejects.toThrow(
      'Missing openai API key',
    );
    expect(fetch).not.toHaveBeenCalled();
    await expect(getLastLlmError()).resolves.toMatchObject({
      experimentId: 'exp',
      code: 'missing_api_key',
    });
  });

  it('calls OpenAI, normalizes output_text, stores cache and increments counters', async () => {
    await setProviderKey('openai', 'sk-openai');
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        output_text: 'Hello',
        usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
      }),
    );

    const first = await completeLlm({ experimentId: 'exp', prompt: 'hello' });
    expect(first).toMatchObject({ text: 'Hello', provider: 'openai', cached: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(getLlmSessionStats()).resolves.toMatchObject({ calls: 1, totalTokens: 5 });

    const second = await completeLlm({ experimentId: 'exp', prompt: 'hello' });
    expect(second).toMatchObject({ text: 'Hello', cached: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(getLlmSessionStats()).resolves.toMatchObject({ calls: 1, cacheHits: 1 });
  });

  it('calls Anthropic and normalizes text blocks and usage', async () => {
    await setProviderKey('anthropic', 'sk-ant');
    await setLlmDefaults({ defaultProvider: 'anthropic' });
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 4, output_tokens: 6 },
      }),
    );

    const result = await completeLlm({ experimentId: 'exp', prompt: 'hello' });
    expect(result).toMatchObject({
      text: 'Hi',
      provider: 'anthropic',
      usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('retries retryable provider failures and does not retry fatal ones', async () => {
    await setProviderKey('openai', 'sk-openai');
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockJsonResponse({ error: { message: 'busy' } }, false, 500))
      .mockResolvedValueOnce(mockJsonResponse({ output_text: 'ok' }));

    await expect(completeLlm({ experimentId: 'exp', prompt: 'retry' })).resolves.toMatchObject({
      text: 'ok',
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValueOnce(
      mockJsonResponse({ error: { message: 'bad key' } }, false, 401),
    );
    await expect(completeLlm({ experimentId: 'exp', prompt: 'fatal' })).rejects.toThrow('bad key');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('tests configured providers with a tiny request', async () => {
    await setProviderKey('openai', 'sk-openai');
    vi.mocked(fetch).mockResolvedValueOnce(mockJsonResponse({ output_text: 'OK' }));
    await expect(testProvider('openai')).resolves.toEqual({ ok: true });
  });
});
