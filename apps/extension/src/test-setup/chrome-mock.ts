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
    onMessage: { addListener: Mock; removeListener: Mock; hasListener: Mock };
    sendMessage: Mock;
    lastError: chrome.runtime.LastError | undefined;
  };
  tabs: {
    query: Mock;
    sendMessage: Mock;
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
  return {
    storage: { local: makeStorageArea(), session: makeStorageArea() },
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      sendMessage: vi.fn(),
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [] as chrome.tabs.Tab[]),
      sendMessage: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', makeChromeMock());
});
