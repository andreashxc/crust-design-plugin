import type { TweakDefinition, TweakValueMap } from '@platform/experiment-sdk';
import { describe, expect, it } from 'vitest';
import {
  controlWriteMode,
  formatTweakValue,
  hasDirtyTweaks,
  isTweakDirty,
  updateTweakValue,
} from './tweaks';

const tweaks = [
  { type: 'toggle', key: 'enabled', label: 'Enabled', default: false },
  { type: 'select', key: 'theme', label: 'Theme', options: ['light', 'dark'], default: 'light' },
  { type: 'text', key: 'title', label: 'Title', default: 'Hello' },
  { type: 'number-slider', key: 'size', label: 'Size', min: 1, max: 10, step: 1, default: 4 },
  { type: 'color', key: 'accent', label: 'Accent', default: '#ff00aa' },
  {
    type: 'multi-select',
    key: 'features',
    label: 'Features',
    options: ['a', 'b', 'c'],
    default: ['a'],
  },
] satisfies TweakDefinition[];

describe('popup tweak helpers', () => {
  it('classifies write modes for all tweak types', () => {
    expect(controlWriteMode(tweaks[0])).toEqual({ mode: 'immediate', delayMs: 0 });
    expect(controlWriteMode(tweaks[1])).toEqual({ mode: 'immediate', delayMs: 0 });
    expect(controlWriteMode(tweaks[2])).toEqual({ mode: 'debounced', delayMs: 400 });
    expect(controlWriteMode(tweaks[3])).toEqual({ mode: 'debounced', delayMs: 300 });
    expect(controlWriteMode(tweaks[4])).toEqual({ mode: 'immediate', delayMs: 0 });
    expect(controlWriteMode(tweaks[5])).toEqual({ mode: 'immediate', delayMs: 0 });
  });

  it('updates one key without mutating the original value map', () => {
    const values: TweakValueMap = { title: 'Hello', size: 4 };
    const next = updateTweakValue(values, 'title', 'Updated');
    expect(next).toEqual({ title: 'Updated', size: 4 });
    expect(values).toEqual({ title: 'Hello', size: 4 });
  });

  it('detects dirty values against defaults', () => {
    expect(isTweakDirty(tweaks[0], { enabled: false })).toBe(false);
    expect(isTweakDirty(tweaks[0], { enabled: true })).toBe(true);
    expect(isTweakDirty(tweaks[5], { features: ['a'] })).toBe(false);
    expect(isTweakDirty(tweaks[5], { features: ['a', 'b'] })).toBe(true);
    expect(
      hasDirtyTweaks(tweaks, { enabled: false, theme: 'light', title: 'Hello', size: 5 }),
    ).toBe(true);
  });

  it('formats values for compact display', () => {
    expect(formatTweakValue(tweaks[0], true)).toBe('On');
    expect(formatTweakValue(tweaks[0], false)).toBe('Off');
    expect(formatTweakValue(tweaks[3], 8)).toBe('8');
    expect(formatTweakValue(tweaks[5], ['a', 'c'])).toBe('a, c');
    expect(formatTweakValue(tweaks[5], [])).toBe('None');
    expect(formatTweakValue(tweaks[4], undefined)).toBe('#ff00aa');
  });
});
