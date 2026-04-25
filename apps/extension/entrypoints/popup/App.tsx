import type { ExperimentManifest as Manifest } from '@platform/experiment-sdk';
import { ExperimentManifest } from '@platform/experiment-sdk';
import { useEffect, useState } from 'react';
import { getEnabledExperiments } from '@/shared/storage';

type Row = { manifest: Manifest; path: string };

function loadManifests(): Row[] {
  const modules = import.meta.glob<{ default: unknown }>('@experiments/*/*/manifest.json', {
    eager: true,
    import: 'default',
  });
  const rows: Row[] = [];
  for (const [path, raw] of Object.entries(modules)) {
    const parsed = ExperimentManifest.safeParse(raw);
    if (parsed.success) rows.push({ manifest: parsed.data, path });
  }
  return rows;
}

export function App() {
  const [rows] = useState<Row[]>(() => loadManifests());
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void getEnabledExperiments().then(setEnabled);
  }, []);

  const handleToggle = (id: string, next: boolean) => {
    setEnabled((prev) => ({ ...prev, [id]: next }));
    chrome.runtime.sendMessage({ type: 'EXPERIMENT_TOGGLE', id, enabled: next });
  };

  if (rows.length === 0) {
    return (
      <div>
        No experiments yet. Add one under <code>experiments/&lt;you&gt;/&lt;id&gt;/</code> and
        rebuild.
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Experiments</h1>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row) => (
          <li
            key={row.manifest.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0',
            }}
          >
            <input
              type="checkbox"
              checked={enabled[row.manifest.id] ?? false}
              onChange={(e) => handleToggle(row.manifest.id, e.target.checked)}
            />
            <span>
              {row.manifest.name} <small style={{ color: '#888' }}>by {row.manifest.author}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
