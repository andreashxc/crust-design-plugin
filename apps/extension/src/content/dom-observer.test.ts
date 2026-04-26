// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomChangeScheduler } from './dom-observer';

describe('createDomChangeScheduler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('schedules reconcile when a normal page node is added', async () => {
    const schedule = vi.fn();
    const cleanup = createDomChangeScheduler(schedule, document.body);

    document.body.append(document.createElement('section'));
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledTimes(1));

    cleanup();
  });

  it('ignores mutations inside extension-owned nodes', async () => {
    const schedule = vi.fn();
    const owned = document.createElement('section');
    owned.dataset.expId = 'exp';
    document.body.append(owned);
    const cleanup = createDomChangeScheduler(schedule, document.body);

    owned.append(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(schedule).not.toHaveBeenCalled();
    cleanup();
  });

  it('ignores adding an extension-owned root node', async () => {
    const schedule = vi.fn();
    const cleanup = createDomChangeScheduler(schedule, document.body);
    const owned = document.createElement('section');
    owned.dataset.expId = 'exp';

    document.body.append(owned);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(schedule).not.toHaveBeenCalled();
    cleanup();
  });
});
