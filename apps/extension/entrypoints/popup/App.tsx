import { RefreshCw, Search, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  filterRegistryBySearch,
  groupByAuthor,
  reorderIds,
  sortAuthorGroupsByOrder,
} from '@/popup/grouping';
import { hydratePopupStore } from '@/popup/registry-refresh';
import { useStore } from '@/popup/store';
import { sendMessage } from '@/shared/messages';
import { setAuthorGroupOrder, sortRegistryByOrder } from '@/shared/storage';
import { matchesScope } from '@/shared/url-match';
import { AuthorGroup } from './components/AuthorGroup';
import { EmptyState } from './components/EmptyState';

export function App() {
  const registry = useStore((state) => state.registry);
  const activeTabUrl = useStore((state) => state.activeTabUrl);
  const bootstrapped = useStore((state) => state.bootstrapped);
  const llmSession = useStore((state) => state.llmSession);
  const experimentOrder = useStore((state) => state.experimentOrder);
  const authorGroupOrder = useStore((state) => state.authorGroupOrder);
  const updateState = useStore((state) => state.updateState);
  const setStoreAuthorGroupOrder = useStore((state) => state.setAuthorGroupOrder);
  const setUpdateState = useStore((state) => state.setUpdateState);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const orderedRegistry = sortRegistryByOrder(registry, experimentOrder);
  const scopedRegistry = activeTabUrl
    ? orderedRegistry.filter((entry) => matchesScope(activeTabUrl, entry.scope))
    : orderedRegistry;
  const filteredRegistry = filterRegistryBySearch(scopedRegistry, query);
  const visibleIds = filteredRegistry.map((entry) => entry.id);
  const groups = sortAuthorGroupsByOrder(
    groupByAuthor(filteredRegistry, { activeTabUrl, matchesScope }),
    authorGroupOrder,
  );
  const visibleAuthors = groups.map((group) => group.author);
  const canSearch = bootstrapped && registry.length > 0;
  const llmLabel =
    llmSession && llmSession.calls > 0
      ? `LLM ${llmSession.calls} ${llmSession.calls === 1 ? 'call' : 'calls'}${
          llmSession.totalTokens > 0 ? ` · ${llmSession.totalTokens} tok` : ''
        }`
      : null;
  const updateUrl = updateState?.available ? updateState.url : null;

  useEffect(() => {
    if (!bootstrapped) return;
    void Promise.resolve(sendMessage('UPDATE_CHECK', undefined)).then((result) => {
      if (result?.state) setUpdateState(result.state);
    });
  }, [bootstrapped, setUpdateState]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function toggleSearch() {
    setSearchOpen((open) => {
      if (open) setQuery('');
      return !open;
    });
  }

  async function persistVisibleAuthorOrder(nextVisibleAuthors: string[]) {
    const visibleSet = new Set(nextVisibleAuthors);
    const nextOrder = [
      ...nextVisibleAuthors,
      ...authorGroupOrder.filter((author) => !visibleSet.has(author)),
    ];
    setStoreAuthorGroupOrder(nextOrder);
    await setAuthorGroupOrder(nextOrder);
  }

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
          {canSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={searchOpen ? 'Hide search' : 'Show search'}
              aria-pressed={searchOpen}
              onClick={toggleSearch}
            >
              <Search className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
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
      {updateUrl ? (
        <div className="border-border/80 bg-muted/35 mt-2 flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
          <span className="text-muted-foreground">Update available</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => void chrome.tabs.create?.({ url: updateUrl })}
          >
            View
          </Button>
        </div>
      ) : null}
      {canSearch && searchOpen ? (
        <div className="relative mt-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            ref={searchInputRef}
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
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
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
            <div className="mt-2">
              <EmptyState variant="scope" />
            </div>
          ) : null}
          {bootstrapped && scopedRegistry.length > 0 && groups.length === 0 ? (
            <div className="mt-2">
              <EmptyState variant="search" />
            </div>
          ) : null}
          {groups.map((group) => (
            <AuthorGroup
              key={group.author}
              group={group}
              visibleIds={visibleIds}
              onMoveAuthor={(draggedAuthor) =>
                void persistVisibleAuthorOrder(
                  reorderIds(visibleAuthors, draggedAuthor, group.author),
                )
              }
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
