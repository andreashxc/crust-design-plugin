import type { TweakDefinition, TweakValue, TweakValueMap } from '@platform/experiment-sdk';

export type TweakWriteMode =
  | { mode: 'immediate'; delayMs: 0 }
  | { mode: 'debounced'; delayMs: 300 | 400 };

export function controlWriteMode(tweak: TweakDefinition): TweakWriteMode {
  switch (tweak.type) {
    case 'text':
      return { mode: 'debounced', delayMs: 400 };
    case 'number-slider':
      return { mode: 'debounced', delayMs: 300 };
    case 'toggle':
    case 'select':
    case 'color':
    case 'multi-select':
      return { mode: 'immediate', delayMs: 0 };
  }
}

export function updateTweakValue(
  values: TweakValueMap,
  key: string,
  value: TweakValue,
): TweakValueMap {
  return { ...values, [key]: value };
}

function valuesEqual(left: TweakValue | undefined, right: TweakValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

export function isTweakDirty(tweak: TweakDefinition, values: TweakValueMap): boolean {
  return !valuesEqual(values[tweak.key], tweak.default);
}

export function hasDirtyTweaks(tweaks: TweakDefinition[], values: TweakValueMap): boolean {
  return tweaks.some((tweak) => isTweakDirty(tweak, values));
}

export function formatTweakValue(tweak: TweakDefinition, value: TweakValue | undefined): string {
  const resolved = value ?? tweak.default;
  switch (tweak.type) {
    case 'toggle':
      return resolved ? 'On' : 'Off';
    case 'multi-select':
      return Array.isArray(resolved) && resolved.length > 0 ? resolved.join(', ') : 'None';
    case 'number-slider':
      return typeof resolved === 'number' ? String(resolved) : String(tweak.default);
    case 'select':
    case 'text':
    case 'color':
      return String(resolved);
  }
}
