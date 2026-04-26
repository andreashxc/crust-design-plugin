import type { LlmProvider } from '@platform/experiment-sdk';
import { Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  clearOptionsLastError,
  clearOptionsLlmCache,
  clearOptionsProviderKey,
  loadOptionsState,
  type OptionsState,
  resetOptionsSession,
  saveLlmDefaults,
  saveProviderKey,
} from '@/options/store';
import { defaultLlmSettings } from '@/shared/storage';

const PROVIDERS: Array<{ id: LlmProvider; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
];

type ProviderInputs = Record<LlmProvider, string>;
type ProviderVisibility = Record<LlmProvider, boolean>;
type ProviderStatus = Partial<Record<LlmProvider, string>>;

function configuredCount(state: OptionsState | null): number {
  if (!state) return 0;
  return PROVIDERS.filter(({ id }) => Boolean(state.settings.providerKeys[id])).length;
}

function providerLabel(provider: LlmProvider): string {
  return PROVIDERS.find((entry) => entry.id === provider)?.label ?? provider;
}

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatTime(value?: number): string {
  if (!value) return 'None';
  return new Date(value).toLocaleString();
}

export function App() {
  const [state, setState] = useState<OptionsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerInputs, setProviderInputs] = useState<ProviderInputs>({
    openai: '',
    anthropic: '',
  });
  const [visibleKeys, setVisibleKeys] = useState<ProviderVisibility>({
    openai: false,
    anthropic: false,
  });
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({});
  const defaults = state?.settings ?? defaultLlmSettings();
  const [defaultProvider, setDefaultProvider] = useState<LlmProvider>(defaults.defaultProvider);
  const [openaiModel, setOpenaiModel] = useState(defaults.models.openai);
  const [anthropicModel, setAnthropicModel] = useState(defaults.models.anthropic);
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    String(defaults.costGuard.maxOutputTokens),
  );
  const [cacheTtlMinutes, setCacheTtlMinutes] = useState(
    String(Math.round(defaults.costGuard.cacheTtlMs / 60000)),
  );
  const [maxAttempts, setMaxAttempts] = useState(String(defaults.costGuard.maxAttempts));
  const [warningCalls, setWarningCalls] = useState(
    String(defaults.costGuard.warningCallsPerSession),
  );
  const [applyRateLimitMs, setApplyRateLimitMs] = useState(
    String(defaults.costGuard.applyRateLimitMs),
  );
  const [cacheEnabled, setCacheEnabled] = useState(defaults.costGuard.cacheEnabled);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [costGuardStatus, setCostGuardStatus] = useState<string | null>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOptionsState()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setDefaultProvider(next.settings.defaultProvider);
        setOpenaiModel(next.settings.models.openai);
        setAnthropicModel(next.settings.models.anthropic);
        setMaxOutputTokens(String(next.settings.costGuard.maxOutputTokens));
        setCacheTtlMinutes(String(Math.round(next.settings.costGuard.cacheTtlMs / 60000)));
        setMaxAttempts(String(next.settings.costGuard.maxAttempts));
        setWarningCalls(String(next.settings.costGuard.warningCallsPerSession));
        setApplyRateLimitMs(String(next.settings.costGuard.applyRateLimitMs));
        setCacheEnabled(next.settings.costGuard.cacheEnabled);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const count = configuredCount(state);
    if (count === PROVIDERS.length) return '2 providers configured';
    if (count === 1) {
      const configured = PROVIDERS.find(({ id }) => Boolean(state?.settings.providerKeys[id]));
      return `${configured?.label ?? '1 provider'} configured`;
    }
    return 'No providers configured';
  }, [state]);

  const defaultProviderMissing = !state?.settings.providerKeys[defaultProvider];

  async function refreshFrom(next: Promise<OptionsState>) {
    const loaded = await next;
    setState(loaded);
    return loaded;
  }

  async function onProviderSave(provider: LlmProvider) {
    const label = providerLabel(provider);
    const key = providerInputs[provider];
    const next = await refreshFrom(saveProviderKey(provider, key));
    setProviderInputs((current) => ({ ...current, [provider]: '' }));
    setProviderStatus((current) => ({
      ...current,
      [provider]: next.settings.providerKeys[provider]
        ? `${label} key saved`
        : `${label} key cleared`,
    }));
  }

  async function onProviderClear(provider: LlmProvider) {
    const label = providerLabel(provider);
    await refreshFrom(clearOptionsProviderKey(provider));
    setProviderInputs((current) => ({ ...current, [provider]: '' }));
    setProviderStatus((current) => ({ ...current, [provider]: `${label} key cleared` }));
  }

  function onProviderTest(provider: LlmProvider) {
    setProviderStatus((current) => ({
      ...current,
      [provider]: `${providerLabel(provider)} test not wired yet`,
    }));
  }

  async function onSaveModels(nextDefaultProvider = defaultProvider) {
    const next = await refreshFrom(
      saveLlmDefaults({
        defaultProvider: nextDefaultProvider,
        models: {
          openai: openaiModel.trim() || defaultLlmSettings().models.openai,
          anthropic: anthropicModel.trim() || defaultLlmSettings().models.anthropic,
        },
      }),
    );
    setDefaultProvider(next.settings.defaultProvider);
    setOpenaiModel(next.settings.models.openai);
    setAnthropicModel(next.settings.models.anthropic);
    setModelStatus('Model settings saved');
  }

  async function onSaveCostGuard() {
    const cacheTtl = parseNonNegativeInteger(cacheTtlMinutes);
    const attempts = parseNonNegativeInteger(maxAttempts);
    const outputTokens = parseNonNegativeInteger(maxOutputTokens);
    const warning = parseNonNegativeInteger(warningCalls);
    const rateLimit = parseNonNegativeInteger(applyRateLimitMs);

    if (
      cacheTtl === null ||
      attempts === null ||
      attempts < 1 ||
      outputTokens === null ||
      outputTokens < 1 ||
      warning === null ||
      warning < 1 ||
      rateLimit === null
    ) {
      setCostGuardStatus(
        'Enter whole numbers. Attempts, tokens, and warning threshold must be at least 1.',
      );
      return;
    }

    const next = await refreshFrom(
      saveLlmDefaults({
        costGuard: {
          cacheEnabled,
          cacheTtlMs: cacheTtl * 60000,
          maxAttempts: attempts,
          maxOutputTokens: outputTokens,
          warningCallsPerSession: warning,
          applyRateLimitMs: rateLimit,
        },
      }),
    );
    setMaxOutputTokens(String(next.settings.costGuard.maxOutputTokens));
    setCacheTtlMinutes(String(Math.round(next.settings.costGuard.cacheTtlMs / 60000)));
    setMaxAttempts(String(next.settings.costGuard.maxAttempts));
    setWarningCalls(String(next.settings.costGuard.warningCallsPerSession));
    setApplyRateLimitMs(String(next.settings.costGuard.applyRateLimitMs));
    setCacheEnabled(next.settings.costGuard.cacheEnabled);
    setCostGuardStatus('Cost guard saved');
  }

  async function onClearCache() {
    await refreshFrom(clearOptionsLlmCache());
    setDiagnosticsStatus('LLM cache cleared');
  }

  async function onResetSession() {
    await refreshFrom(resetOptionsSession());
    setDiagnosticsStatus('Session counters reset');
  }

  async function onClearLastError() {
    await refreshFrom(clearOptionsLastError());
    setDiagnosticsStatus('Last LLM error cleared');
  }

  if (loadError) {
    return (
      <main className="options-shell">
        <section className="options-error">Options failed to load: {loadError}</section>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="options-shell">
        <section className="options-loading">Loading Crust options...</section>
      </main>
    );
  }

  return (
    <main className="options-shell">
      <header className="options-header">
        <div>
          <h1>Crust</h1>
          <p>LLM providers and safety settings</p>
        </div>
        <Badge variant={configuredCount(state) > 0 ? 'secondary' : 'outline'}>{summary}</Badge>
      </header>

      <div className="options-grid">
        <Card className="options-card providers-card">
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>Store API keys locally for helper experiments.</CardDescription>
          </CardHeader>
          <CardContent className="provider-list">
            {PROVIDERS.map(({ id, label }) => {
              const configured = Boolean(state.settings.providerKeys[id]);
              const status =
                providerStatus[id] ?? (configured ? `${label} configured` : `${label} missing`);
              return (
                <section className="provider-row" key={id} aria-label={`${label} provider`}>
                  <div className="provider-heading">
                    <div>
                      <h2>{label}</h2>
                      <p>{configured ? 'Saved key configured' : 'No saved key'}</p>
                    </div>
                    <Badge variant={configured ? 'secondary' : 'outline'}>
                      {configured ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>
                  <div className="provider-controls">
                    <Input
                      aria-label={`${label} API key`}
                      type={visibleKeys[id] ? 'text' : 'password'}
                      value={providerInputs[id]}
                      placeholder={configured ? 'Saved key is masked' : `Paste ${label} API key`}
                      autoComplete="off"
                      onChange={(event) =>
                        setProviderInputs((current) => ({ ...current, [id]: event.target.value }))
                      }
                    />
                    <Button
                      aria-label={`${visibleKeys[id] ? 'Hide' : 'Show'} ${label} API key`}
                      aria-pressed={visibleKeys[id]}
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setVisibleKeys((current) => ({ ...current, [id]: !current[id] }))
                      }
                    >
                      {visibleKeys[id] ? <EyeOff /> : <Eye />}
                    </Button>
                    <Button type="button" size="sm" onClick={() => void onProviderSave(id)}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onProviderClear(id)}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!configured && providerInputs[id].trim().length === 0}
                      onClick={() => onProviderTest(id)}
                    >
                      Test
                    </Button>
                  </div>
                  <p className="row-status">{status}</p>
                </section>
              );
            })}
          </CardContent>
        </Card>

        <Card className="options-card">
          <CardHeader>
            <CardTitle>Defaults</CardTitle>
            <CardDescription>
              Choose the provider and model IDs helper calls use first.
            </CardDescription>
          </CardHeader>
          <CardContent className="settings-stack">
            <label className="field" htmlFor="default-provider">
              <span>Default provider</span>
              <Select
                id="default-provider"
                aria-label="Default provider"
                value={defaultProvider}
                onChange={(event) => {
                  const nextProvider = event.target.value as LlmProvider;
                  setDefaultProvider(nextProvider);
                  void onSaveModels(nextProvider);
                }}
              >
                <SelectOption value="openai">OpenAI</SelectOption>
                <SelectOption value="anthropic">Anthropic</SelectOption>
              </Select>
            </label>
            {defaultProviderMissing ? (
              <p className="warning" role="status">
                Default provider key is missing.
              </p>
            ) : null}
            <div className="two-col">
              <label className="field" htmlFor="openai-model">
                <span>OpenAI model</span>
                <Input
                  id="openai-model"
                  aria-label="OpenAI model"
                  value={openaiModel}
                  onChange={(event) => setOpenaiModel(event.target.value)}
                  onBlur={() => void onSaveModels()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <label className="field" htmlFor="anthropic-model">
                <span>Anthropic model</span>
                <Input
                  id="anthropic-model"
                  aria-label="Anthropic model"
                  value={anthropicModel}
                  onChange={(event) => setAnthropicModel(event.target.value)}
                  onBlur={() => void onSaveModels()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
            </div>
            <div className="action-row">
              <Button type="button" onClick={() => void onSaveModels()}>
                Save models
              </Button>
              {modelStatus ? <p className="row-status">{modelStatus}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="options-card">
          <CardHeader>
            <CardTitle>Cost Guard</CardTitle>
            <CardDescription>Provider-side spend limits are still recommended.</CardDescription>
          </CardHeader>
          <CardContent className="settings-stack">
            <div className="two-col">
              <label className="field" htmlFor="max-output-tokens">
                <span>Max output tokens</span>
                <Input
                  id="max-output-tokens"
                  aria-label="Max output tokens"
                  inputMode="numeric"
                  value={maxOutputTokens}
                  onChange={(event) => setMaxOutputTokens(event.target.value)}
                />
              </label>
              <label className="field" htmlFor="cache-ttl-minutes">
                <span>Cache TTL minutes</span>
                <Input
                  id="cache-ttl-minutes"
                  aria-label="Cache TTL minutes"
                  inputMode="numeric"
                  value={cacheTtlMinutes}
                  onChange={(event) => setCacheTtlMinutes(event.target.value)}
                />
              </label>
              <label className="field" htmlFor="max-attempts">
                <span>Max attempts</span>
                <Input
                  id="max-attempts"
                  aria-label="Max attempts"
                  inputMode="numeric"
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(event.target.value)}
                />
              </label>
              <label className="field" htmlFor="warning-calls">
                <span>Warning calls/session</span>
                <Input
                  id="warning-calls"
                  aria-label="Warning calls per session"
                  inputMode="numeric"
                  value={warningCalls}
                  onChange={(event) => setWarningCalls(event.target.value)}
                />
              </label>
              <label className="field" htmlFor="apply-rate-limit">
                <span>Apply rate limit ms</span>
                <Input
                  id="apply-rate-limit"
                  aria-label="Apply rate limit milliseconds"
                  inputMode="numeric"
                  value={applyRateLimitMs}
                  onChange={(event) => setApplyRateLimitMs(event.target.value)}
                />
              </label>
              <div className="switch-field">
                <span>Use cache</span>
                <Switch
                  aria-label="Use cache for identical prompts"
                  checked={cacheEnabled}
                  onCheckedChange={setCacheEnabled}
                />
              </div>
            </div>
            <div className="action-row">
              <Button type="button" onClick={() => void onSaveCostGuard()}>
                Save cost guard
              </Button>
              {costGuardStatus ? <p className="row-status">{costGuardStatus}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="options-card diagnostics-card">
          <CardHeader>
            <CardTitle>Diagnostics</CardTitle>
            <CardDescription>Session counters and local helper cache controls.</CardDescription>
          </CardHeader>
          <CardContent className="diagnostics">
            <dl>
              <div>
                <dt>Session calls</dt>
                <dd>{state.session.calls}</dd>
              </div>
              <div>
                <dt>Cache hits</dt>
                <dd>{state.session.cacheHits}</dd>
              </div>
              <div>
                <dt>Input tokens</dt>
                <dd>{state.session.inputTokens}</dd>
              </div>
              <div>
                <dt>Output tokens</dt>
                <dd>{state.session.outputTokens}</dd>
              </div>
              <div>
                <dt>Total tokens</dt>
                <dd>{state.session.totalTokens}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatTime(state.session.updatedAt)}</dd>
              </div>
            </dl>
            <section className="last-error" aria-label="Last LLM error">
              <span>Last LLM error</span>
              <p>
                {state.lastError
                  ? `${state.lastError.provider ? `${providerLabel(state.lastError.provider)}: ` : ''}${
                      state.lastError.message
                    }`
                  : 'None'}
              </p>
            </section>
            <div className="diagnostics-actions">
              <Button type="button" variant="outline" size="sm" onClick={() => void onClearCache()}>
                <Trash2 />
                Clear cache
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onResetSession()}
              >
                <RotateCcw />
                Reset session
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onClearLastError()}
              >
                Clear error
              </Button>
            </div>
            {diagnosticsStatus ? <p className="row-status">{diagnosticsStatus}</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
