import { beforeEach, type Mock, vi } from 'vitest';

type StorageRecord = Record<string, unknown>;

type ChangeMap = Record<string, { oldValue?: unknown; newValue?: unknown }>;

type ChangeListener = (
  changes: ChangeMap,
  areaName: 'local' | 'session' | 'managed' | 'sync',
) => void;

type TabUpdatedListener = (tabId: number, changeInfo: { status?: string }) => void;

export type StorageAreaMock = {
  get: Mock;
  set: Mock;
  remove: Mock;
  clear: Mock;
  _data: StorageRecord;
};

export type StorageSessionAreaMock = StorageAreaMock & {
  setAccessLevel: Mock;
};

export type ChromeMock = {
  storage: {
    local: StorageAreaMock;
    session: StorageSessionAreaMock;
    onChanged: { addListener: Mock; removeListener: Mock; hasListener: Mock };
  };
  runtime: {
    id: string;
    onMessage: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    onConnect: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    connect: Mock;
    sendMessage: Mock;
    openOptionsPage: Mock;
    getURL: Mock;
    getManifest: Mock;
    lastError: chrome.runtime.LastError | undefined;
  };
  tabs: {
    query: Mock;
    create: Mock;
    get: Mock;
    update: Mock;
    sendMessage: Mock;
    onUpdated: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    onRemoved: { addListener: Mock; removeListener: Mock; hasListener: Mock };
  };
  windows: {
    create: Mock;
    remove: Mock;
    update: Mock;
  };
  action: {
    setIcon: Mock;
    setBadgeText: Mock;
  };
};

export function makeChromeMock(): ChromeMock {
  // Per-mock listener registry. Fresh registry every beforeEach (since the whole
  // mock instance is rebuilt) so tests can't leak listeners across the suite.
  const changeListeners: ChangeListener[] = [];
  const tabUpdatedListeners: TabUpdatedListener[] = [];

  function fireChange(changes: ChangeMap, areaName: 'local' | 'session'): void {
    for (const l of changeListeners) l(changes, areaName);
  }

  function makeStorageArea(area: 'local' | 'session'): StorageAreaMock {
    const data: StorageRecord = {};
    const mock: StorageAreaMock = {
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
        const changes: ChangeMap = {};
        for (const [k, v] of Object.entries(items)) {
          changes[k] = { oldValue: data[k], newValue: v };
          data[k] = v;
        }
        fireChange(changes, area);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        const changes: ChangeMap = {};
        for (const k of arr) {
          if (k in data) {
            changes[k] = { oldValue: data[k], newValue: undefined };
            delete data[k];
          }
        }
        if (Object.keys(changes).length > 0) fireChange(changes, area);
      }),
      clear: vi.fn(async () => {
        const changes: ChangeMap = {};
        for (const [k, v] of Object.entries(data)) {
          changes[k] = { oldValue: v, newValue: undefined };
          delete data[k];
        }
        if (Object.keys(changes).length > 0) fireChange(changes, area);
      }),
    };
    return mock;
  }

  const sessionBase = makeStorageArea('session');
  const sessionWithAccessLevel: StorageSessionAreaMock = Object.assign(sessionBase, {
    setAccessLevel: vi.fn(async () => {}),
  });

  return {
    storage: {
      local: makeStorageArea('local'),
      session: sessionWithAccessLevel,
      onChanged: {
        addListener: vi.fn((l: ChangeListener) => {
          changeListeners.push(l);
        }),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
    },
    runtime: {
      // Phase 2: webextension-polyfill (loaded transitively by @webext-core/messaging)
      // checks globalThis.chrome.runtime.id at module-eval time and throws
      // "This script should only be loaded in a browser extension" when missing.
      id: 'test-extension-id',
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onConnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      connect: vi.fn(),
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
      getURL: vi.fn((p: string) => `chrome-extension://test/${p.replace(/^\//, '')}`),
      getManifest: vi.fn(() => ({ version: '0.0.0' })),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      create: vi.fn(async () => ({}) as chrome.tabs.Tab),
      get: vi.fn(async (id: number) => ({ id, status: 'complete' }) as chrome.tabs.Tab),
      update: vi.fn(async (id: number, props: chrome.tabs.UpdateProperties) => ({ id, ...props })),
      sendMessage: vi.fn(),
      onUpdated: {
        addListener: vi.fn((l: TabUpdatedListener) => {
          tabUpdatedListeners.push(l);
        }),
        removeListener: vi.fn((l: TabUpdatedListener) => {
          const index = tabUpdatedListeners.indexOf(l);
          if (index >= 0) tabUpdatedListeners.splice(index, 1);
        }),
        hasListener: vi.fn((l: TabUpdatedListener) => tabUpdatedListeners.includes(l)),
      },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    windows: {
      create: vi.fn(async () => ({ id: 1, tabs: [{ id: 2, status: 'complete' }] })),
      remove: vi.fn(async () => {}),
      update: vi.fn(async (id: number, props: chrome.windows.UpdateInfo) => ({ id, ...props })),
    },
    action: {
      setIcon: vi.fn(async () => {}),
      setBadgeText: vi.fn(async () => {}),
    },
  };
}

// CRITICAL — module-load assignment of globalThis.chrome (and its `browser` alias).
// webextension-polyfill (loaded transitively by @webext-core/messaging) checks
// globalThis.chrome?.runtime?.id at MODULE EVAL TIME (before any beforeEach runs).
// Without this assignment, importing @webext-core/messaging in any test file
// throws "This script should only be loaded in a browser extension" at the import
// statement itself, before tests can register. Per-test reset still happens
// inside beforeEach so each test gets a fresh registry.
const initial = makeChromeMock();
(globalThis as unknown as { chrome: ChromeMock }).chrome = initial;
(globalThis as unknown as { browser: ChromeMock }).browser = initial;

// Route @webext-core/messaging through the live chrome mock so tests can assert
// chrome.tabs.sendMessage / chrome.runtime.sendMessage directly. Without this
// factory, the library calls webextension-polyfill which captures references at
// module-load time and ignores per-test vi.stubGlobal swaps. The factory below
// reads `globalThis.chrome` lazily on every call so reassignments in tests stick.
vi.mock('@webext-core/messaging', () => {
  const handlers = new Map<string, (msg: unknown) => unknown>();
  return {
    defineExtensionMessaging: <_TProtocol>() => ({
      sendMessage: (name: string, data: unknown, tabId?: number): Promise<unknown> => {
        const target = (globalThis as unknown as { chrome: typeof chrome }).chrome;
        if (typeof tabId === 'number') {
          return target.tabs.sendMessage(tabId, { name, data });
        }
        return target.runtime.sendMessage({ name, data });
      },
      onMessage: (name: string, handler: (msg: unknown) => unknown) => {
        handlers.set(name, handler);
        const target = (globalThis as unknown as { chrome: typeof chrome }).chrome;
        target.runtime.onMessage.addListener((m: unknown) => {
          const obj = m as { name?: string; data?: unknown };
          if (obj?.name === name) return handler(obj.data);
          return undefined;
        });
        return () => {
          handlers.delete(name);
        };
      },
      removeAllListeners: () => {
        handlers.clear();
      },
    }),
  };
});

beforeEach(() => {
  const fresh = makeChromeMock();
  vi.stubGlobal('chrome', fresh);
  vi.stubGlobal('browser', fresh);
});
