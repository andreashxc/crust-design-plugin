import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AuthorGroup as Group } from '@/popup/grouping';
import { useStore } from '@/popup/store';
import { setAuthorGroupOpenState } from '@/shared/storage';
import { ExperimentRow } from './ExperimentRow';

export function AuthorGroup({ group, visibleIds }: { group: Group; visibleIds: string[] }) {
  const groupId = `author-group-${group.author}`;
  const enabled = useStore((state) => state.enabled);
  const authorGroupOpen = useStore((state) => state.authorGroupOpen);
  const setAuthorGroupOpen = useStore((state) => state.setAuthorGroupOpen);
  const enabledCount = group.entries.filter((entry) => enabled[entry.id]).length;
  const open = authorGroupOpen[group.author] ?? group.defaultOpen;

  function handleOpenChange(nextOpen: boolean) {
    const nextState = { ...authorGroupOpen, [group.author]: nextOpen };
    setAuthorGroupOpen(nextState);
    void setAuthorGroupOpenState(nextState);
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="mt-2">
      <CollapsibleTrigger
        aria-controls={groupId}
        className="border-border/80 bg-muted/35 hover:bg-muted/60 group flex h-7 w-full items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors"
      >
        <ChevronRight className="size-3 group-data-[state=open]:hidden" aria-hidden="true" />
        <ChevronDown className="hidden size-3 group-data-[state=open]:inline" aria-hidden="true" />
        <span>{group.author}</span>
        {enabledCount > 0 ? (
          <span className="text-muted-foreground tabular-nums">{enabledCount}</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent id={groupId} className="mt-2 flex flex-col gap-1.5">
        {group.entries.map((entry) => (
          <ExperimentRow key={entry.id} entry={entry} visibleIds={visibleIds} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
