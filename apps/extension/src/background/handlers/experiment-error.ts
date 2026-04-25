import { broadcastStateChanged } from '@/background/broadcast';
import type { ErrorReport } from '@/shared/messages';
import {
  clearErrorWindow,
  getErrorWindow,
  setAutoDisable,
  setErrorWindow,
  setLastError,
} from '@/shared/storage';

/**
 * Auto-disable threshold (D-11): ≥3 errors in 10 seconds.
 * Constants are file-local — NOT env-tunable in Phase 2.
 *
 * AbortError exclusion (D-02 / D-11): content scripts (Plan 02-07) MUST
 * filter AbortError BEFORE calling sendMessage('EXPERIMENT_ERROR', ...).
 * This handler trusts callers to pre-filter; AbortErrors that reach here
 * count as real errors.
 */
const WINDOW_MS = 10_000;
const THRESHOLD = 3;

export async function handleExperimentError({
  id,
  phase,
  message,
  stack,
}: ErrorReport): Promise<{ ok: true }> {
  const now = Date.now();
  await setLastError(id, { phase, message, stack, at: now });

  const existing = await getErrorWindow(id);
  let next: { count: number; firstAt: number };
  if (!existing || now - existing.firstAt > WINDOW_MS) {
    // Window expired or never started — start fresh.
    next = { count: 1, firstAt: now };
  } else {
    // Same window — increment.
    next = { count: existing.count + 1, firstAt: existing.firstAt };
  }
  await setErrorWindow(id, next);

  if (next.count >= THRESHOLD) {
    await setAutoDisable(id, {
      reason: `≥${THRESHOLD} errors in ${WINDOW_MS / 1000}s`,
      count: next.count,
      firstAt: next.firstAt,
      lastAt: now,
    });
    // Reset so re-arm (D-13 toggle OFF→ON) starts clean.
    await clearErrorWindow(id);
    // Notify popup + content scripts that auto-disable kicked in.
    await broadcastStateChanged();
  }
  return { ok: true };
}
