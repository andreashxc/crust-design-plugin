import type { AutoDisableRecord, ExperimentStatus, RegistryEntry } from '@platform/experiment-sdk';
import { matchesUrl } from '@/shared/url-match';

export function computeStatus(
  entry: RegistryEntry,
  ctx: {
    enabled: boolean;
    autodisabled?: AutoDisableRecord;
    appliedInActiveTab: string[];
    activeTabUrl?: string | null;
  },
): ExperimentStatus {
  if (ctx.autodisabled) return 'auto-disabled';
  if (!ctx.enabled) return 'disabled';
  if (!ctx.activeTabUrl || !matchesUrl(ctx.activeTabUrl, entry.scope.match)) return 'pending';
  if (ctx.appliedInActiveTab.includes(entry.id)) return 'applied';
  return 'error';
}
