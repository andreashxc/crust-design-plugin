import {
  defaultTweakValues,
  type RegistryEntry,
  TweakValueValidationError,
  validateTweakValues,
} from '@platform/experiment-sdk';
import { AlertCircle, ChevronDown, ChevronRight, ChevronUp, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { computeStatus } from '@/popup/status';
import { useStore } from '@/popup/store';
import { sendMessage } from '@/shared/messages';
import {
  clearTweakErrors,
  clearTweakValues,
  setTweakErrors as persistTweakErrors,
  setTweakValues as persistTweakValues,
} from '@/shared/storage';
import { TweakControls } from './TweakControls';

const EMPTY_TWEAK_ERRORS: [] = [];

function shortMessage(message: string): string {
  return message.length > 80 ? `${message.slice(0, 79)}…` : message;
}

export function ExperimentRow({ entry }: { entry: RegistryEntry }) {
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
  const enabledMap = useStore((state) => state.enabled);
  const tweakValuesMap = useStore((state) => state.tweakValues);
  const tweakErrorsMap = useStore((state) => state.tweakErrors);
  const [inFlight, setInFlight] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [stackOpen, setStackOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(enabled);
  const resolvedTweakValues = useMemo(
    () => tweakValues ?? defaultTweakValues(entry.tweaks),
    [entry.tweaks, tweakValues],
  );

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

  return (
    <Card className="border-border/80 bg-card/95 gap-2 rounded-md p-2.5 shadow-none">
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

      {toggleError ? (
        <div className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle className="size-3" aria-hidden="true" />
          Toggle failed: {toggleError}
        </div>
      ) : null}

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
              onChange={handleTweakChange}
              onReset={handleTweakReset}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
