import type { TweakDefinition, TweakValue, TweakValueMap } from '@platform/experiment-sdk';
import { Copy, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { controlWriteMode, formatTweakValue, updateTweakValue } from '@/popup/tweaks';

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
}: TweakControlsProps) {
  const [draftValues, setDraftValues] = useState<TweakValueMap>(values);
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
    const invalid = errorsFor(errors, tweak).length > 0;
    const currentValue = draftValues[tweak.key] ?? values[tweak.key] ?? tweak.default;

    switch (tweak.type) {
      case 'toggle':
        return (
          <Checkbox
            id={controlId}
            aria-invalid={invalid}
            checked={booleanValue(values[tweak.key], tweak.default)}
            onCheckedChange={(checked) => commitValue(tweak, checked)}
          />
        );
      case 'select':
        return (
          <Select
            id={controlId}
            aria-invalid={invalid}
            className="h-8 text-xs"
            value={stringValue(values[tweak.key], tweak.default)}
            onChange={(event) => commitValue(tweak, event.currentTarget.value)}
          >
            {tweak.options.map((option) => (
              <SelectOption key={option} value={option}>
                {option}
              </SelectOption>
            ))}
          </Select>
        );
      case 'text':
        return (
          <Input
            id={controlId}
            aria-invalid={invalid}
            className="h-8 text-xs"
            value={stringValue(currentValue, tweak.default)}
            placeholder={tweak.placeholder}
            onChange={(event) => commitValue(tweak, event.currentTarget.value)}
          />
        );
      case 'number-slider': {
        const value = numberValue(currentValue, tweak.default);
        return (
          <div className="flex items-center gap-2">
            <Slider
              id={controlId}
              aria-invalid={invalid}
              min={tweak.min}
              max={tweak.max}
              step={tweak.step ?? 1}
              value={value}
              className="h-4"
              onValueChange={(next) => commitValue(tweak, next)}
            />
            <output
              htmlFor={controlId}
              className="text-muted-foreground min-w-8 text-right text-xs"
            >
              {formatTweakValue(tweak, value)}
            </output>
          </div>
        );
      }
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <Input
              id={controlId}
              type="color"
              aria-invalid={invalid}
              className="h-8 w-10"
              value={stringValue(values[tweak.key], tweak.default)}
              onChange={(event) => commitValue(tweak, event.currentTarget.value)}
            />
            <span className="text-muted-foreground font-mono text-xs">
              {formatTweakValue(tweak, values[tweak.key])}
            </span>
          </div>
        );
      case 'multi-select': {
        const selected = stringArrayValue(values[tweak.key], tweak.default);
        return (
          <div className="grid gap-1.5" id={controlId} aria-invalid={invalid}>
            {tweak.options.map((option) => {
              const optionId = `${controlId}-${option}`;
              return (
                <div key={option} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    id={optionId}
                    checked={selected.includes(option)}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...selected, option]
                        : selected.filter((value) => value !== option);
                      commitValue(tweak, next);
                    }}
                  />
                  <label htmlFor={optionId}>{option}</label>
                </div>
              );
            })}
          </div>
        );
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">Tweaks</div>
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

      {hasPresets || canCopyPresetCommand ? (
        <div className="border-border/70 bg-muted/20 grid gap-1.5 rounded-sm border p-2">
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

      <div className="space-y-2">
        {tweaks.map((tweak) => {
          const controlErrors = errorsFor(errors, tweak);
          const controlId = `tweak-${tweak.key}`;
          return (
            <div key={tweak.key} className="grid gap-1">
              <label htmlFor={controlId} className="text-xs font-medium">
                {tweak.label}
              </label>
              {tweak.description ? (
                <p className="text-muted-foreground text-xs">{tweak.description}</p>
              ) : null}
              {renderControl(tweak)}
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
