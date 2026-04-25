import { beforeEach, type Mock, vi } from 'vitest';

type StorageRecord = Record<string, unknown>;

type ChangeMap = Record<string, { oldValue?: unknown; newValue?: unknown }>;

type ChangeListener = (
  changes: ChangeMap,
  areaName: 'local' | 'session' | 'managed' | 'sync',
) => void;

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
    onMessage: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    sendMessage: Mock;
    getURL: Mock;
    lastError: chrome.runtime.LastError | undefined;
  };
  tabs: {
    query: Mock;
    sendMessage: Mock;
    onRemoved: { addListener: Mock; removeListener: Mock; hasListener: Mock };
  };
};

export function makeChromeMock(): ChromeMock {
  // Per-mock listener registry. Fresh registry every beforeEach (since the whole
  // mock instance is rebuilt) so tests can't leak listeners across the suite.
  const changeListeners: ChangeListener[] = [];

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
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      sendMessage: vi.fn(),
      getURL: vi.fn((p: string) => `chrome-extension://test/${p.replace(/^\//, '')}`),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      sendMessage: vi.fn(),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', makeChromeMock());
});
