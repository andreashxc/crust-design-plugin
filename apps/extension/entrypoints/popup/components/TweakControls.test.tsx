// @vitest-environment jsdom

import type { TweakDefinition, TweakValueMap } from '@platform/experiment-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TweakControls } from './TweakControls';

const tweaks = [
  { type: 'toggle', key: 'enabled', label: 'Enabled', default: false },
  { type: 'select', key: 'theme', label: 'Theme', options: ['light', 'dark'], default: 'light' },
  {
    type: 'text',
    key: 'headline',
    label: 'Headline',
    default: 'Hello',
    placeholder: 'Enter headline',
  },
  { type: 'number-slider', key: 'size', label: 'Size', min: 1, max: 10, step: 1, default: 4 },
  { type: 'color', key: 'accent', label: 'Accent', default: '#ff00aa' },
  {
    type: 'multi-select',
    key: 'features',
    label: 'Features',
    options: ['alpha', 'beta', 'gamma'],
    default: ['alpha'],
  },
] satisfies TweakDefinition[];

const values: TweakValueMap = {
  enabled: false,
  theme: 'light',
  headline: 'Hello',
  size: 4,
  accent: '#ff00aa',
  features: ['alpha'],
};

describe('TweakControls', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('returns null when there are no tweaks', () => {
    const { container } = render(
      <TweakControls tweaks={[]} values={{}} errors={[]} onChange={vi.fn()} onReset={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all six controls and reset', () => {
    render(
      <TweakControls
        tweaks={tweaks}
        values={values}
        errors={[]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('Tweaks')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Headline' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Size' })).toBeTruthy();
    expect(screen.getByLabelText('Accent')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'beta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reset/ })).toBeTruthy();
  });

  it('writes immediate control changes', () => {
    const onChange = vi.fn();
    render(
      <TweakControls
        tweaks={tweaks}
        values={values}
        errors={[]}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, enabled: true });

    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), {
      target: { value: 'dark' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...values, theme: 'dark' });

    fireEvent.change(screen.getByLabelText('Accent'), { target: { value: '#112233' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...values, accent: '#112233' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'beta' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, features: ['alpha', 'beta'] });
  });

  it('debounces text changes for 400ms', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <TweakControls
        tweaks={tweaks}
        values={values}
        errors={[]}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Headline' }), {
      target: { value: 'Hello world' },
    });
    vi.advanceTimersByTime(399);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledWith({ ...values, headline: 'Hello world' });
  });

  it('debounces slider changes for 300ms', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <TweakControls
        tweaks={tweaks}
        values={values}
        errors={[]}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Size' }), { target: { value: '7' } });
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledWith({ ...values, size: 7 });
  });

  it('shows validation errors near controls and calls reset', () => {
    const onReset = vi.fn();
    render(
      <TweakControls
        tweaks={tweaks}
        values={values}
        errors={[{ path: ['headline'], message: 'Headline is too long' }]}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );

    expect(screen.getByText('Headline is too long')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
