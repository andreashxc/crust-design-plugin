import type {
  AutoDisableRecord,
  ErrorRecord,
  Registry,
  TweakValidationError,
  TweakValueMap,
} from '@platform/experiment-sdk';
import { create, type StateCreator } from 'zustand';
import type { LastLlmError, LlmSessionStats, PublicLlmConfig } from '@/shared/storage';

type RegistrySlice = {
  registry: Registry;
  setRegistry: (registry: Registry) => void;
};

type StorageSlice = {
  enabled: Record<string, boolean>;
  autodisabled: Record<string, AutoDisableRecord>;
  lastError: Record<string, ErrorRecord>;
  tweakValues: Record<string, TweakValueMap>;
  tweakErrors: Record<string, TweakValidationError[]>;
  llmSession: LlmSessionStats | null;
  publicLlmConfig: PublicLlmConfig | null;
  lastLlmError?: LastLlmError;
  setEnabled: (enabled: Record<string, boolean>) => void;
  setAutoDisabled: (autodisabled: Record<string, AutoDisableRecord>) => void;
  setLastError: (lastError: Record<string, ErrorRecord>) => void;
  setTweakValues: (tweakValues: Record<string, TweakValueMap>) => void;
  setTweakErrors: (tweakErrors: Record<string, TweakValidationError[]>) => void;
  setLlmSession: (llmSession: LlmSessionStats | null) => void;
  setPublicLlmConfig: (publicLlmConfig: PublicLlmConfig | null) => void;
  setLastLlmError: (lastLlmError?: LastLlmError) => void;
};

type TabSlice = {
  activeTabId: number | null;
  activeTabUrl: string | null;
  appliedInActiveTab: string[];
  bootstrapped: boolean;
  setActiveTab: (id: number | null) => void;
  setActiveTabUrl: (url: string | null) => void;
  setAppliedInActiveTab: (ids: string[]) => void;
  setBootstrapped: (bootstrapped: boolean) => void;
};

export type RootState = RegistrySlice & StorageSlice & TabSlice;

const registrySlice: StateCreator<RootState, [], [], RegistrySlice> = (set) => ({
  registry: [],
  setRegistry: (registry) => set({ registry }),
});

const storageSlice: StateCreator<RootState, [], [], StorageSlice> = (set) => ({
  enabled: {},
  autodisabled: {},
  lastError: {},
  tweakValues: {},
  tweakErrors: {},
  llmSession: null,
  publicLlmConfig: null,
  lastLlmError: undefined,
  setEnabled: (enabled) => set({ enabled }),
  setAutoDisabled: (autodisabled) => set({ autodisabled }),
  setLastError: (lastError) => set({ lastError }),
  setTweakValues: (tweakValues) => set({ tweakValues }),
  setTweakErrors: (tweakErrors) => set({ tweakErrors }),
  setLlmSession: (llmSession) => set({ llmSession }),
  setPublicLlmConfig: (publicLlmConfig) => set({ publicLlmConfig }),
  setLastLlmError: (lastLlmError) => set({ lastLlmError }),
});

const tabSlice: StateCreator<RootState, [], [], TabSlice> = (set) => ({
  activeTabId: null,
  activeTabUrl: null,
  appliedInActiveTab: [],
  bootstrapped: false,
  setActiveTab: (activeTabId) => set({ activeTabId }),
  setActiveTabUrl: (activeTabUrl) => set({ activeTabUrl }),
  setAppliedInActiveTab: (appliedInActiveTab) => set({ appliedInActiveTab }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
});

export const useStore = create<RootState>()((...args) => ({
  ...registrySlice(...args),
  ...storageSlice(...args),
  ...tabSlice(...args),
}));
