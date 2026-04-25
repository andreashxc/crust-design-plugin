import { beforeEach, type Mock, vi } from 'vitest';

type StorageRecord = Record<string, unknown>;

export type StorageAreaMock = {
  get: Mock;
  set: Mock;
  remove: Mock;
  clear: Mock;
  _data: StorageRecord;
};

export type ChromeMock = {
  storage: { local: StorageAreaMock; session: StorageAreaMock };
  runtime: {
    id: string;
    onMessage: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    sendMessage: Mock;
    getURL: Mock;
    lastError: chrome.runtime.LastError | undefined;
  };
  tabs: {
    query: Mock;
    sendMessage: Mock;
    onRemoved: { addListener: Mock; removeListener: Mock };
  };
};

function makeStorageArea(): StorageAreaMock {
  const data: StorageRecord = {};
  const area: StorageAreaMock = {
    _data: data,
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return { ...data };
      if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
      if (Array.isArray(keys)) {
        const out: StorageRecord = {};
        for (const k of keys) if (k in data) out[k] = data[k];
        return out;
      }
      return {};
    }),
    set: vi.fn(async (items: StorageRecord) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    }),
    clear: vi.fn(async () => {
      for (const k of Object.keys(data)) delete data[k];
    }),
  };
  return area;
}

export function makeChromeMock(): ChromeMock {
  const sessionArea = makeStorageArea();
  // Phase 2: storage.session.setAccessLevel mock for R6 (content-script writes).
  (sessionArea as unknown as { setAccessLevel: Mock }).setAccessLevel = vi.fn(async () => {});
  return {
    storage: { local: makeStorageArea(), session: sessionArea },
    runtime: {
      // Phase 2: webextension-polyfill (used by @webext-core/messaging) requires
      // globalThis.chrome.runtime.id to detect extension context. Set a stable test id.
      id: 'test-extension-id',
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      sendMessage: vi.fn(),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
}

// CRITICAL: webextension-polyfill (loaded transitively by @webext-core/messaging)
// checks `globalThis.chrome?.runtime?.id` at module-eval time and throws
// "This script should only be loaded in a browser extension" when missing. The
// setupFiles entry runs BEFORE test-file imports, so we set chrome up at module
// load to satisfy that check before the polyfill evaluates.
const initialMock = makeChromeMock();
// biome-ignore lint/suspicious/noExplicitAny: required for global stubbing
(globalThis as any).chrome = initialMock;
// biome-ignore lint/suspicious/noExplicitAny: required for global stubbing
(globalThis as any).browser = initialMock;

// Mock @webext-core/messaging so handlers/broadcast use the LIVE chrome mock per
// test (the real library wraps chrome via webextension-polyfill, which caches a
// reference at module-eval time and ignores per-test vi.stubGlobal swaps).
//
// Behavior matches @webext-core/messaging:
//   sendMessage(name, data, tabId?) → tabs.sendMessage(tabId, ...) when tabId given,
//                                     runtime.sendMessage(...) otherwise.
//   onMessage(name, handler) → registers handler keyed by name; envelope shape
//                              { data, sender }. Tests can invoke handlers via
//                              the optional `__handlers` map exposed below.
type MessagingHandler = (envelope: {
  data: unknown;
  sender: chrome.runtime.MessageSender;
}) => unknown;

const __handlers = new Map<string, MessagingHandler>();
// biome-ignore lint/suspicious/noExplicitAny: vitest mock factory escape hatch
(globalThis as any).__webext_messaging_handlers__ = __handlers;

vi.mock('@webext-core/messaging', () => {
  function defineExtensionMessaging<_P>() {
    return {
      sendMessage: vi.fn(async (name: string, data?: unknown, tabId?: number) => {
        // biome-ignore lint/suspicious/noExplicitAny: chrome global at runtime
        const c = (globalThis as any).chrome as ChromeMock;
        const message = { type: name, data };
        if (typeof tabId === 'number') {
          return c.tabs.sendMessage(tabId, message);
        }
        return c.runtime.sendMessage(message);
      }),
      onMessage: vi.fn((name: string, handler: MessagingHandler) => {
        __handlers.set(name, handler);
        return () => __handlers.delete(name);
      }),
    };
  }
  return { defineExtensionMessaging };
});

beforeEach(() => {
  const mock = makeChromeMock();
  vi.stubGlobal('chrome', mock);
  vi.stubGlobal('browser', mock);
  // Reset handler map between tests so leftover registrations don't leak.
  __handlers.clear();
});
