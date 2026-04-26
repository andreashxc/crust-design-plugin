import {
  defaultTweakValues,
  type RegistryEntry,
  TweakValueValidationError,
  validateTweakValues,
} from '@platform/experiment-sdk';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { reorderIds } from '@/popup/grouping';
import { computeStatus } from '@/popup/status';
import { useStore } from '@/popup/store';
import { sendMessage } from '@/shared/messages';
import {
  clearTweakErrors,
  clearTweakValues,
  setExperimentOrder as persistExperimentOrder,
  setTweakErrors as persistTweakErrors,
  setTweakValues as persistTweakValues,
} from '@/shared/storage';
import { TweakControls } from './TweakControls';

const EMPTY_TWEAK_ERRORS: [] = [];

function shortMessage(message: string): string {
  return message.length > 80 ? `${message.slice(0, 79)}…` : message;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function descriptionWarning(status: RegistryEntry['descriptionStatus']): string | null {
  if (status === 'missing') return 'Description missing';
  if (status === 'stale') return 'Description stale';
  return null;
}

export function ExperimentRow({
  entry,
  visibleIds,
  index,
}: {
  entry: RegistryEntry;
  visibleIds: string[];
  index: number;
}) {
  const enabled = useStore((state) => state.enabled[entry.id] ?? false);
  const autodisabled = useStore((state) => state.autodisabled[entry.id]);
  const lastError = useStore((state) => state.lastError[entry.id]);
  const appliedInActiveTab = useStore((state) => state.appliedInActiveTab);
  const activeTabId = useStore((state) => state.activeTabId);
  const activeTabUrl = useStore((state) => state.activeTabUrl);
  const tweakValues = useStore((state) => state.tweakValues[entry.id]);
  const tweakErrors = useStore((state) => state.tweakErrors[entry.id]);
  const publicLlmConfig = useStore((state) => state.publicLlmConfig);
  const lastLlmError = useStore((state) => state.lastLlmError);
  const setEnabled = useStore((state) => state.setEnabled);
  const setStoreTweakValues = useStore((state) => state.setTweakValues);
  const setStoreTweakErrors = useStore((state) => state.setTweakErrors);
  const setStoreExperimentOrder = useStore((state) => state.setExperimentOrder);
  const enabledMap = useStore((state) => state.enabled);
  const tweakValuesMap = useStore((state) => state.tweakValues);
  const tweakErrorsMap = useStore((state) => state.tweakErrors);
  const experimentOrder = useStore((state) => state.experimentOrder);
  const [inFlight, setInFlight] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [stackOpen, setStackOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(enabled);
  const [sourceStatus, setSourceStatus] = useState<string | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [presetSaveName, setPresetSaveName] = useState('custom-preset');
  const [presetStatus, setPresetStatus] = useState<string | null>(null);
  const resolvedTweakValues = useMemo(
    () => tweakValues ?? defaultTweakValues(entry.tweaks),
    [entry.tweaks, tweakValues],
  );
  const descWarning = descriptionWarning(entry.descriptionStatus);

  const status = computeStatus(entry, {
    enabled,
    autodisabled,
    appliedInActiveTab,
    activeTabUrl,
  });
  const shouldShowError = status === 'error' || status === 'auto-disabled';
  const canToggleTweaks = enabled && entry.tweaks.length > 0;
  const missingLlmKey =
    enabled &&
    lastLlmError?.experimentId === entry.id &&
    lastLlmError.code === 'missing_api_key' &&
    publicLlmConfig &&
    !publicLlmConfig.providers[lastLlmError.provider ?? publicLlmConfig.defaultProvider]
      ?.configured;

  async function notifyTweakChange() {
    const result = await sendMessage('TWEAKS_CHANGED', { id: entry.id });
    if (activeTabId != null) {
      await sendMessage('TWEAKS_CHANGED', { id: entry.id }, activeTabId).catch(() => {});
    }
    return result;
  }

  async function handleToggle(next: boolean) {
    setInFlight(true);
    setToggleError(null);
    const previousTweaksOpen = tweaksOpen;
    if (!next) setTweaksOpen(false);
    setEnabled({ ...enabledMap, [entry.id]: next });
    try {
      const result = await sendMessage('EXPERIMENT_TOGGLE', { id: entry.id, enabled: next });
      if (!result?.ok) {
        setTweaksOpen(previousTweaksOpen);
        setEnabled(enabledMap);
        setToggleError(result?.error ?? 'Unknown error');
      }
    } catch (err) {
      setTweaksOpen(previousTweaksOpen);
      setEnabled(enabledMap);
      setToggleError(err instanceof Error ? err.message : String(err));
    } finally {
      setInFlight(false);
    }
  }

  async function handleTweakChange(nextValues: Record<string, unknown>) {
    try {
      const validValues = validateTweakValues(entry.tweaks, nextValues);
      setStoreTweakValues({ ...tweakValuesMap, [entry.id]: validValues });
      setStoreTweakErrors({ ...tweakErrorsMap, [entry.id]: [] });
      await persistTweakValues(entry.id, validValues);
      await clearTweakErrors(entry.id);
      const result = await notifyTweakChange();
      if (!result?.ok) {
        setStoreTweakErrors({
          ...tweakErrorsMap,
          [entry.id]: [{ message: result?.error ?? 'Failed to apply tweak changes' }],
        });
      }
    } catch (err) {
      const errors =
        err instanceof TweakValueValidationError
          ? err.issues
          : [{ message: err instanceof Error ? err.message : String(err) }];
      setStoreTweakErrors({ ...tweakErrorsMap, [entry.id]: errors });
      await persistTweakErrors(entry.id, errors);
    }
  }

  async function handleTweakReset() {
    const defaults = defaultTweakValues(entry.tweaks);
    setStoreTweakValues({ ...tweakValuesMap, [entry.id]: defaults });
    setStoreTweakErrors({ ...tweakErrorsMap, [entry.id]: [] });
    await clearTweakValues(entry.id);
    await clearTweakErrors(entry.id);
    await notifyTweakChange().catch(() => {});
  }

  async function handlePresetLoad(name: string) {
    if (!name) return;
    const preset = entry.presets?.find((item) => item.name === name);
    if (!preset) return;

    try {
      const validValues = validateTweakValues(entry.tweaks, preset.values);
      setStoreTweakValues({ ...tweakValuesMap, [entry.id]: validValues });
      setStoreTweakErrors({ ...tweakErrorsMap, [entry.id]: [] });
      await persistTweakValues(entry.id, validValues);
      await clearTweakErrors(entry.id);
      setSelectedPresetName(preset.name);
      setPresetStatus(`Loaded ${preset.name}`);
      const result = await notifyTweakChange();
      if (!result?.ok) {
        setStoreTweakErrors({
          ...tweakErrorsMap,
          [entry.id]: [{ message: result?.error ?? 'Failed to apply preset' }],
        });
      }
    } catch (err) {
      const errors =
        err instanceof TweakValueValidationError
          ? err.issues
          : [{ message: err instanceof Error ? err.message : String(err) }];
      setStoreTweakErrors({ ...tweakErrorsMap, [entry.id]: errors });
      await persistTweakErrors(entry.id, errors);
      setPresetStatus(`Preset "${preset.name}" is invalid`);
    }
  }

  async function handleCopyPresetCommand() {
    const name = presetSaveName.trim() || 'custom-preset';
    const command = [
      'corepack pnpm save-preset',
      shellQuote(`${entry.author}/${entry.folder}`),
      shellQuote(name),
      shellQuote(JSON.stringify(resolvedTweakValues)),
    ].join(' ');
    try {
      await navigator.clipboard?.writeText(command);
      setPresetStatus('Save command copied');
    } catch {
      setPresetStatus(command);
    }
  }

  async function persistVisibleOrder(nextVisibleIds: string[]) {
    const visibleSet = new Set(nextVisibleIds);
    const nextOrder = [...nextVisibleIds, ...experimentOrder.filter((id) => !visibleSet.has(id))];
    setStoreExperimentOrder(nextOrder);
    await persistExperimentOrder(nextOrder);
    await notifyTweakChange().catch(() => {});
  }

  async function moveTo(overId: string | undefined) {
    if (!overId) return;
    await persistVisibleOrder(reorderIds(visibleIds, entry.id, overId));
  }

  async function handleOpenSource() {
    if (!entry.sourceDir) return;
    setSourceStatus(null);
    try {
      await chrome.tabs.create?.({ url: `cursor://file/${encodeURI(entry.sourceDir)}` });
    } catch {
      await navigator.clipboard?.writeText(entry.sourceDir);
      setSourceStatus('Path copied');
    }
  }

  return (
    <Card
      className="border-border/80 bg-card/95 gap-2 rounded-md p-2.5 shadow-none"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', entry.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain');
        void persistVisibleOrder(reorderIds(visibleIds, draggedId, entry.id));
      }}
    >
      <div
        className={cn(
          'relative',
          canToggleTweaks && (tweaksOpen ? 'border-border/80 border-b pb-8' : 'pb-0'),
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{entry.name}</div>
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
              {entry.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Drag ${entry.name}`}
              className="text-muted-foreground h-6 w-5 cursor-grab"
            >
              <GripVertical className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${entry.name} up`}
              className="text-muted-foreground h-6 w-5"
              disabled={index === 0}
              onClick={() => void moveTo(visibleIds[index - 1])}
            >
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${entry.name} down`}
              className="text-muted-foreground h-6 w-5"
              disabled={index >= visibleIds.length - 1}
              onClick={() => void moveTo(visibleIds[index + 1])}
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </Button>
            {entry.sourceDir ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Open ${entry.name} in Cursor`}
                className="text-muted-foreground h-6 w-5"
                onClick={() => void handleOpenSource()}
              >
                <FolderOpen className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
            {inFlight ? <Loader2 className="size-3 animate-spin" aria-label="Updating" /> : null}
            <Switch
              aria-label={`Toggle ${entry.name}`}
              checked={enabled}
              disabled={inFlight}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>

        {canToggleTweaks ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={
              tweaksOpen ? `Collapse tweaks for ${entry.name}` : `Expand tweaks for ${entry.name}`
            }
            aria-expanded={tweaksOpen}
            className={cn(
              'text-muted-foreground hover:text-foreground absolute right-1 size-5 rounded-sm',
              tweaksOpen ? 'bottom-1' : 'bottom-0',
            )}
            onClick={() => setTweaksOpen((current) => !current)}
          >
            {tweaksOpen ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>

      {descWarning ? <div className="text-muted-foreground text-xs">{descWarning}</div> : null}

      {toggleError ? (
        <div className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle className="size-3" aria-hidden="true" />
          Toggle failed: {toggleError}
        </div>
      ) : null}

      {sourceStatus ? <div className="text-muted-foreground text-xs">{sourceStatus}</div> : null}

      {missingLlmKey ? (
        <div className="text-muted-foreground border-border/80 bg-muted/40 mt-1 flex items-center justify-between gap-2 rounded-sm border px-2 py-1 text-xs">
          <span>
            LLM key missing for {lastLlmError.provider ?? publicLlmConfig.defaultProvider}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => chrome.runtime.openOptionsPage?.()}
          >
            Options
          </Button>
        </div>
      ) : null}

      {shouldShowError && (lastError || autodisabled) ? (
        <div className="text-destructive mt-1 text-xs">
          {autodisabled ? (
            <div>
              Disabled after {autodisabled.count} errors in 10s — toggle off/on to re-enable.
            </div>
          ) : null}
          {lastError ? <div>Last error: {shortMessage(lastError.message)}</div> : null}
          {lastError?.stack ? (
            <Collapsible open={stackOpen} onOpenChange={setStackOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-1 h-7 px-0 text-xs">
                  {stackOpen ? (
                    <ChevronDown className="size-3" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-3" aria-hidden="true" />
                  )}
                  {stackOpen ? 'Hide stack trace' : 'Show stack trace'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="bg-muted text-muted-foreground mt-1 max-h-40 overflow-auto rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap">
                  {lastError.stack}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      ) : null}

      {canToggleTweaks ? (
        <div>
          {tweaksOpen ? (
            <TweakControls
              tweaks={entry.tweaks}
              values={resolvedTweakValues}
              errors={tweakErrors ?? EMPTY_TWEAK_ERRORS}
              presets={entry.presets}
              selectedPresetName={selectedPresetName}
              presetSaveName={presetSaveName}
              presetStatus={presetStatus}
              onChange={handleTweakChange}
              onReset={handleTweakReset}
              onPresetLoad={(name) => void handlePresetLoad(name)}
              onPresetSaveNameChange={setPresetSaveName}
              onCopyPresetCommand={() => void handleCopyPresetCommand()}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
