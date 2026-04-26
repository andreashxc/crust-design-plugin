import { RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupByAuthor } from '@/popup/grouping';
import { hydratePopupStore } from '@/popup/registry-refresh';
import { useStore } from '@/popup/store';
import { matchesScope } from '@/shared/url-match';
import { AuthorGroup } from './components/AuthorGroup';
import { EmptyState } from './components/EmptyState';

export function App() {
  const registry = useStore((state) => state.registry);
  const activeTabUrl = useStore((state) => state.activeTabUrl);
  const bootstrapped = useStore((state) => state.bootstrapped);
  const llmSession = useStore((state) => state.llmSession);
  const [refreshing, setRefreshing] = useState(false);
  const groups = groupByAuthor(registry, { activeTabUrl, matchesScope });
  const llmLabel =
    llmSession && llmSession.calls > 0
      ? `LLM ${llmSession.calls} ${llmSession.calls === 1 ? 'call' : 'calls'}${
          llmSession.totalTokens > 0 ? ` · ${llmSession.totalTokens} tok` : ''
        }`
      : null;

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 px-0.5 py-0.5">
        <h1 className="text-sm font-semibold">Crust</h1>
        <div className="flex items-center gap-1.5">
          {llmLabel ? (
            <span className="text-muted-foreground px-1 text-xs font-medium tabular-nums">
              {llmLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Reload experiments"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void hydratePopupStore()
                .catch((err: unknown) => {
                  console.error('[popup] registry refresh failed', err);
                })
                .finally(() => setRefreshing(false));
            }}
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Open Crust options"
            onClick={() => chrome.runtime.openOptionsPage?.()}
          >
            <Settings className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <ScrollArea className="mt-2 max-h-[calc(100vh-4rem)] min-h-0 pr-2">
        <div className="pb-3">
          {!bootstrapped && registry.length === 0 ? <div>Reading state…</div> : null}
          {bootstrapped && registry.length === 0 ? <EmptyState /> : null}
          {bootstrapped && registry.length > 0 && groups.length === 0 ? (
            <div className="text-muted-foreground mt-2 text-xs">No experiments match this page</div>
          ) : null}
          {groups.map((group) => (
            <AuthorGroup key={group.author} group={group} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
