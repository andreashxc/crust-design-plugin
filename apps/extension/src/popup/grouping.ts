import type { Registry, RegistryEntry } from '@platform/experiment-sdk';

export type AuthorGroup = {
  author: string;
  entries: RegistryEntry[];
  defaultOpen: boolean;
};

export function groupByAuthor(
  registry: Registry,
  ctx: {
    activeTabUrl?: string | null;
    matchesScope: (url: string, scope: RegistryEntry['scope']) => boolean;
  },
): AuthorGroup[] {
  const byAuthor = new Map<string, RegistryEntry[]>();
  for (const entry of registry) {
    if (ctx.activeTabUrl && !ctx.matchesScope(ctx.activeTabUrl, entry.scope)) continue;
    const entries = byAuthor.get(entry.author) ?? [];
    entries.push(entry);
    byAuthor.set(entry.author, entries);
  }

  const groups = Array.from(byAuthor.entries()).map(([author, entries]) => ({
    author,
    entries,
    defaultOpen: false,
  }));

  if (groups.length === 1 && groups[0]) {
    groups[0].defaultOpen = true;
  }

  return groups;
}

export function filterRegistryBySearch(registry: Registry, query: string): Registry {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return registry;
  return registry.filter((entry) =>
    [entry.name, entry.author, entry.description].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

export function sortAuthorGroupsByOrder(groups: AuthorGroup[], order: string[]): AuthorGroup[] {
  const orderIndex = new Map(order.map((author, index) => [author, index]));
  return groups
    .map((group, index) => ({ group, index, order: orderIndex.get(group.author) }))
    .sort((left, right) => {
      if (left.order != null && right.order != null) return left.order - right.order;
      if (left.order != null) return -1;
      if (right.order != null) return 1;
      return left.index - right.index;
    })
    .map(({ group }) => group);
}

export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  if (activeId === overId) return ids;
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (!item) return ids;
  next.splice(to, 0, item);
  return next;
}
