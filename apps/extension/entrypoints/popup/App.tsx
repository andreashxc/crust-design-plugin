import { RefreshCw, Search, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filterRegistryBySearch, groupByAuthor } from '@/popup/grouping';
import { hydratePopupStore } from '@/popup/registry-refresh';
import { useStore } from '@/popup/store';
import { sortRegistryByOrder } from '@/shared/storage';
import { matchesScope } from '@/shared/url-match';
import { AuthorGroup } from './components/AuthorGroup';
import { EmptyState } from './components/EmptyState';

export function App() {
  const registry = useStore((state) => state.registry);
  const activeTabUrl = useStore((state) => state.activeTabUrl);
  const bootstrapped = useStore((state) => state.bootstrapped);
  const llmSession = useStore((state) => state.llmSession);
  const experimentOrder = useStore((state) => state.experimentOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const orderedRegistry = sortRegistryByOrder(registry, experimentOrder);
  const scopedRegistry = activeTabUrl
    ? orderedRegistry.filter((entry) => matchesScope(activeTabUrl, entry.scope))
    : orderedRegistry;
  const filteredRegistry = filterRegistryBySearch(scopedRegistry, query);
  const visibleIds = filteredRegistry.map((entry) => entry.id);
  const groups = groupByAuthor(filteredRegistry, { activeTabUrl, matchesScope });
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
      {bootstrapped && registry.length > 0 ? (
        <div className="relative mt-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            aria-label="Search experiments"
            placeholder="Search experiments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 px-7 text-xs"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
              onClick={() => setQuery('')}
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
      <ScrollArea className="mt-2 max-h-[calc(100vh-4rem)] min-h-0 pr-2">
        <div className="pb-3">
          {!bootstrapped && registry.length === 0 ? <div>Reading state…</div> : null}
          {bootstrapped && registry.length === 0 ? <EmptyState /> : null}
          {bootstrapped && registry.length > 0 && scopedRegistry.length === 0 ? (
            <div className="text-muted-foreground mt-2 text-xs">No experiments match this page</div>
          ) : null}
          {bootstrapped && scopedRegistry.length > 0 && groups.length === 0 ? (
            <div className="text-muted-foreground mt-2 text-xs">No matches</div>
          ) : null}
          {groups.map((group) => (
            <AuthorGroup key={group.author} group={group} visibleIds={visibleIds} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
