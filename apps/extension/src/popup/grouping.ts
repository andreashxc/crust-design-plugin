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

  return Array.from(byAuthor.entries())
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([author, entries]) => ({
      author,
      entries,
      defaultOpen: Boolean(ctx.activeTabUrl && entries.length > 0),
    }));
}
