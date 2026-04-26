import { describe, expect, it, vi } from 'vitest';
import { setProviderKey } from '@/shared/storage';
import { wireLlmStreamPort } from './stream';

function mockPort() {
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  return {
    name: 'LLM_STREAM',
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      for (const listener of disconnectListeners) listener();
    }),
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void) => {
        messageListeners.push(listener);
      }),
    },
    onDisconnect: {
      addListener: vi.fn((listener: () => void) => {
        disconnectListeners.push(listener);
      }),
    },
    emit(message: unknown) {
      for (const listener of messageListeners) listener(message);
    },
  } as unknown as chrome.runtime.Port & {
    emit(message: unknown): void;
    postMessage: ReturnType<typeof vi.fn>;
  };
}

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe('LLM stream port', () => {
  it('posts delta then done over a long-lived port', async () => {
    await setProviderKey('openai', 'sk-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ output_text: 'streamed', usage: { total_tokens: 3 } })),
    );
    const port = mockPort();

    wireLlmStreamPort(port);
    port.emit({ type: 'start', experimentId: 'exp', prompt: 'hello' });

    await vi.waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith({ type: 'delta', delta: 'streamed' });
      expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'done',
          result: expect.objectContaining({ text: 'streamed' }),
        }),
      );
    });
  });

  it('posts structured error on missing key', async () => {
    const port = mockPort();

    wireLlmStreamPort(port);
    port.emit({ type: 'start', experimentId: 'exp', prompt: 'hello' });

    await vi.waitFor(() => {
      expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', error: 'Missing openai API key' }),
      );
    });
  });
});
