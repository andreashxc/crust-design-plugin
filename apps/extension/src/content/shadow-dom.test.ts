import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const shadowPanelSource = readFileSync(
  fileURLToPath(
    new URL('../../../../experiments/examples/shadow-panel/experiment.ts', import.meta.url),
  ),
  'utf8',
);

describe('shadow-panel reference experiment source', () => {
  it('creates UI inside a ShadowRoot', () => {
    expect(shadowPanelSource).toMatch(/\.attachShadow\(|createShadowRootUi/);
  });

  it('does not inject global styles into document.head', () => {
    expect(shadowPanelSource).not.toMatch(/document\.head\.append/);
  });
});
