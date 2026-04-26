import type { UpdateCheckResult } from '@/shared/messages';
import { getUpdateState, setUpdateState, type UpdateState } from '@/shared/storage';

export const UPDATE_CHECK_TTL_MS = 30 * 60 * 1000;
const REPO = 'andreashxc/overlay-plugin';
const DEFAULT_BRANCH = 'main';

type CompareResponse = {
  status?: string;
  ahead_by?: number;
  behind_by?: number;
  html_url?: string;
  commits?: Array<{ sha?: string; html_url?: string }>;
  merge_base_commit?: { sha?: string };
};

type UpdateCheckOptions = {
  now?: () => number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  currentVersion?: string;
  currentCommit?: string;
  endpoint?: string;
};

function runtimeVersion(): string {
  return chrome.runtime.getManifest?.().version ?? '0.0.0';
}

function buildEndpoint(currentCommit: string): string {
  return `https://api.github.com/repos/${REPO}/compare/${currentCommit}...${DEFAULT_BRANCH}`;
}

function currentCommitFromEnv(): string {
  return (import.meta.env.CRUST_CURRENT_COMMIT as string | undefined) ?? '';
}

function remoteCommitFromCompare(body: CompareResponse, fallback: string): string | undefined {
  return body.commits?.at(-1)?.sha ?? body.merge_base_commit?.sha ?? fallback;
}

function isAvailable(body: CompareResponse): boolean {
  return body.status === 'behind' || (typeof body.behind_by === 'number' && body.behind_by > 0);
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'application/vnd.github+json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function handleUpdateCheck(
  options: UpdateCheckOptions = {},
): Promise<UpdateCheckResult> {
  const now = options.now?.() ?? Date.now();
  const cached = await getUpdateState();
  if (cached && now - cached.checkedAt < UPDATE_CHECK_TTL_MS) {
    return { ok: true, state: cached };
  }

  const currentVersion = options.currentVersion ?? runtimeVersion();
  const currentCommit = options.currentCommit ?? currentCommitFromEnv();
  if (!currentCommit || currentCommit === 'local') {
    const state: UpdateState = {
      currentVersion,
      currentCommit,
      available: false,
      checkedAt: now,
      error: 'Current commit is unavailable',
    };
    await setUpdateState(state);
    return { ok: false, error: state.error ?? 'Update check unavailable', state };
  }

  try {
    const endpoint = options.endpoint ?? buildEndpoint(currentCommit);
    const response = await fetchWithTimeout(
      endpoint,
      options.timeoutMs ?? 5000,
      options.fetchImpl ?? fetch,
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const body = (await response.json()) as CompareResponse;
    const state: UpdateState = {
      currentVersion,
      currentCommit,
      remoteCommit: remoteCommitFromCompare(body, currentCommit),
      available: isAvailable(body),
      checkedAt: now,
      url: body.html_url ?? `https://github.com/${REPO}`,
    };
    await setUpdateState(state);
    return { ok: true, state };
  } catch (err) {
    const state: UpdateState = {
      currentVersion,
      currentCommit,
      available: false,
      checkedAt: now,
      error: err instanceof Error ? err.message : String(err),
    };
    await setUpdateState(state);
    return { ok: false, error: state.error ?? 'Update check failed', state };
  }
}
