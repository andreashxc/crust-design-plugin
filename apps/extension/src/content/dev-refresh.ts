import type { RegistryEntry } from '@platform/experiment-sdk';
import { matchesScope } from '@/shared/url-match';

export type DevRegistryRefreshOptions = {
  enabled: boolean;
  intervalMs?: number;
  loadEntries: () => Promise<RegistryEntry[]>;
  getEnabledExperiments: () => Promise<Record<string, boolean>>;
  getCurrentUrl: () => string;
  schedule: () => void;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  onError?: (err: unknown) => void;
};

export function startDevRegistryRefresh(options: DevRegistryRefreshOptions): () => void {
  if (!options.enabled) return () => {};

  const intervalMs = options.intervalMs ?? 750;
  const setTimer = options.setInterval ?? setInterval;
  const clearTimer = options.clearInterval ?? clearInterval;
  const onError = options.onError ?? ((err) => console.debug('[engine] dev refresh failed', err));
  let lastSignature: string | undefined;
  let inFlight = false;

  const check = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const [entries, enabled] = await Promise.all([
        options.loadEntries(),
        options.getEnabledExperiments(),
      ]);
      const signature = createRegistryApplySignature(entries, enabled, options.getCurrentUrl());
      if (lastSignature !== undefined && signature !== lastSignature) options.schedule();
      lastSignature = signature;
    } catch (err) {
      onError(err);
    } finally {
      inFlight = false;
    }
  };

  void check();
  const timer = setTimer(() => void check(), intervalMs);
  return () => clearTimer(timer);
}

export function createRegistryApplySignature(
  entries: RegistryEntry[],
  enabled: Record<string, boolean>,
  url: string,
): string {
  return entries
    .filter((entry) => enabled[entry.id] && matchesScope(url, entry.scope))
    .map((entry) => `${entry.id}:${entry.chunkPath}:${entry.sourceSignature ?? ''}`)
    .join('|');
}
