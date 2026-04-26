export function EmptyState({
  variant = 'registry',
}: {
  variant?: 'registry' | 'scope' | 'search';
}) {
  if (variant === 'scope') {
    return <div className="text-muted-foreground text-xs">No experiments match this page.</div>;
  }

  if (variant === 'search') {
    return <div className="text-muted-foreground text-xs">No experiments match this search.</div>;
  }

  return (
    <div className="text-muted-foreground text-xs">
      No experiments yet. Run <code>corepack pnpm dev</code> or build after adding one under{' '}
      <code>experiments/&lt;you&gt;/&lt;id&gt;/</code>.
    </div>
  );
}
