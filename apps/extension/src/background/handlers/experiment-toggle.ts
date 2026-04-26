import { broadcastStateChanged } from '@/background/broadcast';
import type { ProtocolMap } from '@/shared/messages';
import {
  appendExperimentOrder,
  clearAutoDisable,
  clearErrorWindow,
  clearLastError,
  setEnabledExperiment,
} from '@/shared/storage';

type Args = Parameters<ProtocolMap['EXPERIMENT_TOGGLE']>[0];
type Result = ReturnType<ProtocolMap['EXPERIMENT_TOGGLE']>;

/**
 * Handles popup-driven toggle. D-13 recovery: toggle ON re-arms by
 * clearing autodisabled[id] and error_window:<id>. Toggle OFF is just a
 * state write; no auto-clear of autodisabled (user intent: turn off, but
 * the engine kill-switch state is preserved until they explicitly re-arm
 * via toggle ON).
 */
export async function handleExperimentToggle({ id, enabled }: Args): Promise<Result> {
  try {
    await setEnabledExperiment(id, enabled);
    if (enabled) {
      await appendExperimentOrder(id);
      // D-13 recovery: ON re-arms. Order: clear, clear, broadcast.
      await clearAutoDisable(id);
      await clearErrorWindow(id);
      await clearLastError(id);
    }
    await broadcastStateChanged();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
