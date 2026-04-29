import type { TweakDefinition, TweakValue, TweakValueMap } from '@platform/experiment-sdk';
import { ColorControl, Slider as DialSlider, SelectControl, TextControl, Toggle } from 'dialkit';
import { Copy, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { controlWriteMode, updateTweakValue } from '@/popup/tweaks';

type TweakControlError = {
  path?: Array<string | number>;
  message: string;
};

type TweakControlsProps = {
  tweaks: TweakDefinition[];
  values: TweakValueMap;
  errors?: TweakControlError[];
  presets?: Array<{ name: string; values: Record<string, unknown> }>;
  selectedPresetName?: string | null;
  presetSaveName?: string;
  presetStatus?: string | null;
  onChange: (nextValues: TweakValueMap) => void;
  onReset: () => void;
  onPresetLoad?: (name: string) => void;
  onPresetSaveNameChange?: (name: string) => void;
  onCopyPresetCommand?: () => void;
  tweakActions?: Partial<Record<string, ReactNode>>;
};

function stringValue(value: TweakValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: TweakValue | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function booleanValue(value: TweakValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArrayValue(value: TweakValue | undefined, fallback: string[]): string[] {
  return Array.isArray(value) ? value : fallback;
}

function errorKey(error: TweakControlError): string | undefined {
  const path = error.path ?? [];
  const firstString = path.find((part): part is string => typeof part === 'string');
  return firstString;
}

function errorsFor(errors: TweakControlError[] | undefined, tweak: TweakDefinition): string[] {
  return (errors ?? [])
    .filter((error) => errorKey(error) === tweak.key)
    .map((error) => error.message);
}

function LabelledTextControl({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = rootRef.current?.querySelector('input');
    input?.setAttribute('aria-label', label);
  }, [label]);

  return (
    <div ref={rootRef}>
      <TextControl label={label} value={value} placeholder={placeholder} onChange={onChange} />
    </div>
  );
}

function LabelledColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = rootRef.current?.querySelector('input[type="color"]');
    input?.setAttribute('aria-label', label);
  }, [label]);

  return (
    <div ref={rootRef}>
      <ColorControl label={label} value={value} onChange={onChange} />
    </div>
  );
}

export function TweakControls({
  tweaks,
  values,
  errors = [],
  presets = [],
  selectedPresetName = null,
  presetSaveName = '',
  presetStatus = null,
  onChange,
  onReset,
  onPresetLoad,
  onPresetSaveNameChange,
  onCopyPresetCommand,
  tweakActions = {},
}: TweakControlsProps) {
  const [draftValues, setDraftValues] = useState<TweakValueMap>(values);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setDraftValues(values);
  }, [values]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  if (tweaks.length === 0) return null;
  const hasPresets = presets.length > 0;
  const canCopyPresetCommand = Boolean(onCopyPresetCommand);
  const hasPresetTools = hasPresets || canCopyPresetCommand;

  function commitValue(tweak: TweakDefinition, value: TweakValue) {
    const writeMode = controlWriteMode(tweak);
    if (writeMode.mode === 'immediate') {
      onChange(updateTweakValue(values, tweak.key, value));
      return;
    }

    setDraftValues((current) => updateTweakValue(current, tweak.key, value));
    clearTimeout(timers.current[tweak.key]);
    timers.current[tweak.key] = setTimeout(() => {
      onChange(updateTweakValue(values, tweak.key, value));
      delete timers.current[tweak.key];
    }, writeMode.delayMs);
  }

  function renderControl(tweak: TweakDefinition) {
    const controlId = `tweak-${tweak.key}`;
    const currentValue = draftValues[tweak.key] ?? values[tweak.key] ?? tweak.default;

    switch (tweak.type) {
      case 'toggle':
        return (
          <>
            <input
              id={controlId}
              type="checkbox"
              aria-label={tweak.label}
              className="sr-only"
              checked={booleanValue(values[tweak.key], tweak.default)}
              onChange={(event) => commitValue(tweak, event.currentTarget.checked)}
            />
            <Toggle
              label={tweak.label}
              checked={booleanValue(values[tweak.key], tweak.default)}
              onChange={(checked) => commitValue(tweak, checked)}
            />
          </>
        );
      case 'select':
        return (
          <>
            <select
              id={controlId}
              aria-label={tweak.label}
              className="sr-only"
              value={stringValue(values[tweak.key], tweak.default)}
              onChange={(event) => commitValue(tweak, event.currentTarget.value)}
            >
              {tweak.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <SelectControl
              label={tweak.label}
              value={stringValue(values[tweak.key], tweak.default)}
              options={tweak.options}
              onChange={(value) => commitValue(tweak, value)}
            />
          </>
        );
      case 'text':
        return (
          <LabelledTextControl
            label={tweak.label}
            value={stringValue(currentValue, tweak.default)}
            placeholder={tweak.placeholder}
            onChange={(value) => commitValue(tweak, value)}
          />
        );
      case 'number-slider': {
        const value = numberValue(currentValue, tweak.default);
        return (
          <>
            <input
              id={controlId}
              type="range"
              aria-label={tweak.label}
              className="sr-only"
              min={tweak.min}
              max={tweak.max}
              step={tweak.step ?? 1}
              value={value}
              onChange={(event) => commitValue(tweak, event.currentTarget.valueAsNumber)}
            />
            <DialSlider
              label={tweak.label}
              min={tweak.min}
              max={tweak.max}
              step={tweak.step ?? 1}
              value={value}
              onChange={(next) => commitValue(tweak, next)}
            />
          </>
        );
      }
      case 'color':
        return (
          <LabelledColorControl
            label={tweak.label}
            value={stringValue(values[tweak.key], tweak.default)}
            onChange={(value) => commitValue(tweak, value)}
          />
        );
      case 'multi-select': {
        const selected = stringArrayValue(values[tweak.key], tweak.default);
        return (
          <div className="dialkit-multi-select">
            <div className="dialkit-multi-select-label">{tweak.label}</div>
            {tweak.options.map((option) => {
              const optionId = `${controlId}-${option}`;
              return (
                <div key={option} className="grid gap-0">
                  <input
                    id={optionId}
                    type="checkbox"
                    aria-label={option}
                    className="sr-only"
                    checked={selected.includes(option)}
                    onChange={(event) => {
                      const next = event.currentTarget.checked
                        ? [...selected, option]
                        : selected.filter((value) => value !== option);
                      commitValue(tweak, next);
                    }}
                  />
                  <Toggle
                    label={option}
                    checked={selected.includes(option)}
                    onChange={(checked) => {
                      const next = checked
                        ? [...selected, option]
                        : selected.filter((value) => value !== option);
                      commitValue(tweak, next);
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">Tweaks</div>
        <div className="flex items-center gap-1">
          {hasPresetTools ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              aria-expanded={presetsOpen}
              onClick={() => setPresetsOpen((current) => !current)}
            >
              <SlidersHorizontal className="size-3" aria-hidden="true" />
              Presets
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </div>

      {hasPresetTools && presetsOpen ? (
        <div className="bg-background/70 grid gap-1.5 rounded-lg p-2">
          {hasPresets ? (
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="preset-load" className="text-xs font-medium">
                  Preset
                </label>
                {selectedPresetName ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {selectedPresetName}
                  </span>
                ) : null}
              </div>
              <Select
                id="preset-load"
                aria-label="Load preset"
                className="h-8 text-xs"
                value=""
                onChange={(event) => onPresetLoad?.(event.currentTarget.value)}
              >
                <SelectOption value="">Load preset...</SelectOption>
                {presets.map((preset) => (
                  <SelectOption key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectOption>
                ))}
              </Select>
            </div>
          ) : null}

          {canCopyPresetCommand ? (
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <Input
                aria-label="Preset name"
                className="h-8 text-xs"
                value={presetSaveName}
                onChange={(event) => onPresetSaveNameChange?.(event.currentTarget.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={onCopyPresetCommand}
              >
                <Copy className="size-3" aria-hidden="true" />
                Copy command
              </Button>
            </div>
          ) : null}

          {presetStatus ? (
            <div className="text-muted-foreground text-xs">{presetStatus}</div>
          ) : null}
        </div>
      ) : null}

      <div className="tweak-dialkit flex flex-col gap-1.5">
        {tweaks.map((tweak) => {
          const controlErrors = errorsFor(errors, tweak);
          const action = tweakActions[tweak.key];
          return (
            <div key={tweak.key} className="grid gap-1">
              {tweak.description ? (
                <p className="text-muted-foreground text-xs">{tweak.description}</p>
              ) : null}
              {action ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                  <div className="min-w-0">{renderControl(tweak)}</div>
                  {action}
                </div>
              ) : (
                renderControl(tweak)
              )}
              {controlErrors.map((message) => (
                <div key={message} className="text-destructive text-xs">
                  {message}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
