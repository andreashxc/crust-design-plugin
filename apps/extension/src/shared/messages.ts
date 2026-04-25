/**
 * Typed message contract between popup, background SW, and content scripts.
 *
 * Per CONTEXT D-15 + RESEARCH Step 4.1: Phase 1 keeps two message types only.
 * Phase 2 will introduce richer messages via @webext-core/messaging.
 */
export type ExtensionMessage =
  | { type: 'EXPERIMENT_TOGGLE'; id: string; enabled: boolean }
  | { type: 'STATE_CHANGED' };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return t === 'EXPERIMENT_TOGGLE' || t === 'STATE_CHANGED';
}
