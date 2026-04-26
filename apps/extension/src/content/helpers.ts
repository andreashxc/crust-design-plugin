import type {
  CleanupFn,
  FetchPageResult,
  Helpers,
  InjectNodeOptions,
  InjectStyleOptions,
  LlmOptions,
  WaitForOptions,
} from '@platform/experiment-sdk';
import { sendMessage } from '@/shared/messages';

export type HelperFactoryArgs = {
  experimentId: string;
  log?: (msg: string, ...args: unknown[]) => void;
  signal?: AbortSignal;
};

export function createHelpers(args: HelperFactoryArgs): Helpers {
  return createHelperContext(args).helpers;
}

export function createHelperContext(args: HelperFactoryArgs): {
  helpers: Helpers;
  cleanup: CleanupFn;
} {
  const log =
    args.log ?? ((msg, ...rest) => console.debug('[exp]', args.experimentId, msg, ...rest));
  const ledger: CleanupFn[] = [];
  const track = (cleanup: CleanupFn) => {
    ledger.push(cleanup);
    return cleanup;
  };
  const llm = (async (prompt: string, options?: LlmOptions & { stream?: boolean }) => {
    if (options?.stream) {
      return streamLlm(args.experimentId, prompt, { ...options, stream: true });
    }
    const result = await sendMessage('LLM_COMPLETE', {
      experimentId: args.experimentId,
      prompt,
      options: options as LlmOptions | undefined,
    });
    return result.text;
  }) as Helpers['llm'];

  args.signal?.addEventListener(
    'abort',
    () => {
      void cleanupLedger(ledger);
    },
    { once: true },
  );

  return {
    helpers: {
      log,
      llm,
      fetchPage: (url: string, selector?: string): Promise<FetchPageResult> =>
        sendMessage('FETCH_PAGE', { url, selector }),
      injectStyle: (css: string, options?: InjectStyleOptions) => {
        const doc = globalThis.document;
        if (!doc) throw new Error('injectStyle requires a document');
        const style = doc.createElement('style');
        style.dataset.expId = args.experimentId;
        if (options?.id) style.id = options.id;
        style.textContent = css;
        const target = options?.target === 'body' ? doc.body : doc.head;
        target.append(style);
        track(() => style.remove());
        return style;
      },
      injectNode: (node, target?: ParentNode, options?: InjectNodeOptions) => {
        const parent = target ?? globalThis.document?.body;
        if (!parent) throw new Error('injectNode requires a target node');
        if (node instanceof Element && parent instanceof Element) {
          parent.insertAdjacentElement(options?.position ?? 'beforeend', node);
        } else {
          parent.appendChild(node);
        }
        track(() => {
          if (node.isConnected) node.parentNode?.removeChild(node);
        });
        return node;
      },
      waitFor: <TElement extends Element = Element>(
        selector: string,
        options?: WaitForOptions,
      ): Promise<TElement> => waitForElement(selector, options, args.signal, track),
      onUrlChange: (callback) => {
        const handler = () => callback(location.href);
        window.addEventListener('popstate', handler);
        window.addEventListener('hashchange', handler);
        const originalPush = history.pushState;
        const originalReplace = history.replaceState;
        const patchedPushState = function pushState(
          this: History,
          ...params: Parameters<History['pushState']>
        ) {
          const result = originalPush.apply(this, params);
          handler();
          return result;
        };
        const patchedReplaceState = function replaceState(
          this: History,
          ...params: Parameters<History['replaceState']>
        ) {
          const result = originalReplace.apply(this, params);
          handler();
          return result;
        };
        history.pushState = patchedPushState;
        history.replaceState = patchedReplaceState;
        return track(() => {
          window.removeEventListener('popstate', handler);
          window.removeEventListener('hashchange', handler);
          if (history.pushState === patchedPushState) history.pushState = originalPush;
          if (history.replaceState === patchedReplaceState) history.replaceState = originalReplace;
        });
      },
    },
    cleanup: () => cleanupLedger(ledger),
  };
}

function streamLlm(
  experimentId: string,
  prompt: string,
  options: Omit<LlmOptions, 'stream'> & { stream: true; onDelta?: (delta: string) => void },
) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'LLM_STREAM' });
    let partial = '';
    let completed = false;
    port.onMessage.addListener(
      (message: {
        type?: string;
        delta?: string;
        result?: unknown;
        error?: string;
        partial?: string;
      }) => {
        if (message.type === 'delta') {
          const delta = message.delta ?? '';
          partial += delta;
          options.onDelta?.(delta);
        }
        if (message.type === 'done') {
          completed = true;
          port.disconnect();
          resolve(message.result);
        }
        if (message.type === 'error') {
          completed = true;
          reject(new Error(message.error ?? `LLM stream failed: ${message.partial ?? partial}`));
        }
      },
    );
    port.onDisconnect.addListener(() => {
      if (!completed) reject(new Error(`LLM stream closed before completion: ${partial}`));
    });
    port.postMessage({
      type: 'start',
      experimentId,
      prompt,
      options: { ...options, stream: false },
    });
  });
}

async function cleanupLedger(ledger: CleanupFn[]): Promise<void> {
  const cleanups = ledger.splice(0).reverse();
  for (const cleanup of cleanups) await cleanup();
}

function waitForElement<TElement extends Element>(
  selector: string,
  options: WaitForOptions | undefined,
  signal: AbortSignal | undefined,
  track: (cleanup: CleanupFn) => CleanupFn,
): Promise<TElement> {
  const root = options?.root ?? globalThis.document;
  const existing = root?.querySelector(selector);
  if (existing) return Promise.resolve(existing as TElement);

  return new Promise((resolve, reject) => {
    if (!root) {
      reject(new Error('waitFor requires a document'));
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const found = root.querySelector(selector);
      if (!found) return;
      settle(() => resolve(found as TElement));
    });
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => settle(() => reject(new DOMException('Aborted', 'AbortError')));
    observer.observe(root instanceof Document ? root.documentElement : root, {
      childList: true,
      subtree: true,
    });
    track(() => observer.disconnect());
    signal?.addEventListener('abort', onAbort, { once: true });
    if (options?.timeoutMs) {
      timeoutId = setTimeout(
        () => settle(() => reject(new Error(`Timed out waiting for ${selector}`))),
        options.timeoutMs,
      );
    }
  });
}
