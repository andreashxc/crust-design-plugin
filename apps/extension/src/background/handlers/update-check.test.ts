import { describe, expect, it, vi } from 'vitest';
import { getUpdateState, setUpdateState } from '@/shared/storage';
import { handleUpdateCheck, UPDATE_CHECK_TTL_MS } from './update-check';

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('handleUpdateCheck', () => {
  it('sets available=true when current commit is behind remote main', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        status: 'behind',
        behind_by: 2,
        html_url: 'https://github.com/andreashxc/crust-design-plugin/compare/abc...main',
        commits: [{ sha: 'def' }],
      }),
    );

    const result = await handleUpdateCheck({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      now: () => 1000,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: true, state: { available: true, remoteCommit: 'def' } });
    await expect(getUpdateState()).resolves.toMatchObject({ available: true });
  });

  it('sets available=false when current commit matches remote main', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        status: 'identical',
        behind_by: 0,
        merge_base_commit: { sha: 'abc' },
      }),
    );

    const result = await handleUpdateCheck({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      now: () => 1000,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: true, state: { available: false, remoteCommit: 'abc' } });
  });

  it('network failure returns ok=false and caches quiet diagnostics', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await handleUpdateCheck({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      now: () => 1000,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: false, error: 'offline' });
    await expect(getUpdateState()).resolves.toMatchObject({
      available: false,
      error: 'offline',
    });
  });

  it('uses cached result for 30 minutes', async () => {
    await setUpdateState({
      currentVersion: '0.0.0',
      currentCommit: 'abc',
      remoteCommit: 'def',
      available: true,
      checkedAt: 1000,
    });
    const fetchImpl = vi.fn();

    const result = await handleUpdateCheck({
      now: () => 1000 + UPDATE_CHECK_TTL_MS - 1,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: true, state: { available: true } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
