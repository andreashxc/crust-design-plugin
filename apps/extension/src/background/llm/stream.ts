import type { LlmResult } from '@platform/experiment-sdk';
import { completeLlm } from '@/background/llm/service';
import type { LlmCompleteRequest } from '@/shared/messages';

export type LlmStreamStart = LlmCompleteRequest & { type: 'start' };
export type LlmStreamServerMessage =
  | { type: 'delta'; delta: string }
  | { type: 'done'; result: LlmResult }
  | { type: 'error'; error: string; partial?: string };

type RuntimePort = chrome.runtime.Port;

export function registerLlmStreamHandler(runtime: typeof chrome.runtime = chrome.runtime): void {
  try {
    runtime.onConnect.addListener((port) => {
      if (port.name !== 'LLM_STREAM') return;
      wireLlmStreamPort(port);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('not implemented')) {
      console.warn('[bg] LLM stream port listener unavailable in this runtime', err);
    }
  }
}

export function wireLlmStreamPort(port: RuntimePort): void {
  let partial = '';
  let closed = false;
  port.onDisconnect.addListener(() => {
    closed = true;
  });
  port.onMessage.addListener((message: LlmStreamStart) => {
    if (message?.type !== 'start') return;
    void completeLlm(message)
      .then((result) => {
        partial = result.text;
        if (closed) return;
        port.postMessage({ type: 'delta', delta: result.text } satisfies LlmStreamServerMessage);
        port.postMessage({ type: 'done', result } satisfies LlmStreamServerMessage);
      })
      .catch((err: unknown) => {
        if (closed) return;
        port.postMessage({
          type: 'error',
          error: err instanceof Error ? err.message : String(err),
          partial,
        } satisfies LlmStreamServerMessage);
      });
  });
}
