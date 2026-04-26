import type { LlmOptions, LlmProvider, LlmResult, LlmUsage } from '@platform/experiment-sdk';
import {
  buildLlmCacheKey,
  clearLlmCache,
  getLlmCache,
  getLlmSettings,
  incrementLlmSessionStats,
  setLastLlmError,
  setLlmCache,
} from '@/shared/storage';

export type CompleteLlmRequest = {
  experimentId: string;
  prompt: string;
  options?: LlmOptions;
};

type NormalizedResponse = {
  text: string;
  usage?: LlmUsage;
};

type RetryClass = 'retryable' | 'fatal';

export class LlmServiceError extends Error {
  readonly provider?: LlmProvider;
  readonly code?: string;
  readonly retryClass: RetryClass;

  constructor(
    message: string,
    options: { provider?: LlmProvider; code?: string; retryClass?: RetryClass } = {},
  ) {
    super(message);
    this.name = 'LlmServiceError';
    this.provider = options.provider;
    this.code = options.code;
    this.retryClass = options.retryClass ?? 'fatal';
  }
}

export async function completeLlm(request: CompleteLlmRequest): Promise<LlmResult> {
  const settings = await getLlmSettings();
  const provider = request.options?.provider ?? settings.defaultProvider;
  const key = settings.providerKeys[provider];
  const model = request.options?.model ?? settings.models[provider];
  const maxOutputTokens = request.options?.maxOutputTokens ?? settings.costGuard.maxOutputTokens;

  if (!key) {
    const error = new LlmServiceError(`Missing ${provider} API key`, {
      provider,
      code: 'missing_api_key',
    });
    await rememberError(error, request.experimentId);
    throw error;
  }

  const cacheHash = buildLlmCacheKey({
    provider,
    model,
    prompt: request.prompt,
    maxOutputTokens,
    cacheKey: request.options?.cacheKey,
  });
  const cacheEnabled = settings.costGuard.cacheEnabled;
  if (cacheEnabled) {
    const cached = await getLlmCache(cacheHash);
    if (cached) {
      await incrementLlmSessionStats({ cacheHits: 1 });
      return {
        text: cached.text,
        provider: cached.provider,
        model: cached.model,
        cached: true,
        usage: cached.usage,
      };
    }
  }

  try {
    const response = await retry(
      () => completeProvider({ provider, key, model, prompt: request.prompt, maxOutputTokens }),
      settings.costGuard.maxAttempts,
    );
    await incrementLlmSessionStats({
      calls: 1,
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      totalTokens:
        response.usage?.totalTokens ??
        (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0),
    });
    if (cacheEnabled) {
      const now = Date.now();
      await setLlmCache(cacheHash, {
        text: response.text,
        provider,
        model,
        cachedAt: now,
        expiresAt: now + (request.options?.cacheTtlMs ?? settings.costGuard.cacheTtlMs),
        usage: response.usage,
      });
    }
    return { text: response.text, provider, model, cached: false, usage: response.usage };
  } catch (err) {
    const error = normalizeThrown(provider, err);
    await rememberError(error, request.experimentId);
    throw error;
  }
}

export async function testProvider(
  provider: LlmProvider,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await getLlmSettings();
  try {
    const key = settings.providerKeys[provider];
    if (!key)
      throw new LlmServiceError(`Missing ${provider} API key`, {
        provider,
        code: 'missing_api_key',
      });
    await completeProvider({
      provider,
      key,
      model: settings.models[provider],
      prompt: 'Reply with OK.',
      maxOutputTokens: 8,
    });
    return { ok: true };
  } catch (err) {
    const error = normalizeThrown(provider, err);
    await rememberError(error);
    return { ok: false, error: error.message };
  }
}

export async function clearLlmRuntimeCache(): Promise<{ ok: true }> {
  await clearLlmCache();
  return { ok: true };
}

async function retry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const normalized = normalizeThrown(undefined, err);
      if (normalized.retryClass === 'fatal' || attempt >= maxAttempts) break;
      await sleep(100 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function completeProvider(args: {
  provider: LlmProvider;
  key: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<NormalizedResponse> {
  return args.provider === 'openai' ? completeOpenAi(args) : completeAnthropic(args);
}

async function completeOpenAi(args: {
  key: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<NormalizedResponse> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${args.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      input: args.prompt,
      max_output_tokens: args.maxOutputTokens,
    }),
  });
  const json = await parseProviderJson('openai', response);
  const text =
    typeof json.output_text === 'string' ? json.output_text : extractOpenAiOutputText(json.output);
  return {
    text,
    usage: normalizeOpenAiUsage(json.usage),
  };
}

async function completeAnthropic(args: {
  key: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
}): Promise<NormalizedResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': args.key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxOutputTokens,
      messages: [{ role: 'user', content: args.prompt }],
    }),
  });
  const json = await parseProviderJson('anthropic', response);
  return {
    text: Array.isArray(json.content)
      ? json.content
          .filter((part: { type?: string; text?: string }) => part.type === 'text')
          .map((part: { text?: string }) => part.text ?? '')
          .join('')
      : '',
    usage: normalizeAnthropicUsage(json.usage),
  };
}

async function parseProviderJson(
  provider: LlmProvider,
  response: Response,
): Promise<Record<string, unknown>> {
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new LlmServiceError(providerErrorMessage(provider, json, response.status), {
      provider,
      code: String(response.status),
      retryClass: response.status === 429 || response.status >= 500 ? 'retryable' : 'fatal',
    });
  }
  return json;
}

function providerErrorMessage(
  provider: LlmProvider,
  json: Record<string, unknown>,
  status: number,
): string {
  const message =
    isRecord(json.error) && typeof json.error.message === 'string'
      ? json.error.message
      : typeof json.message === 'string'
        ? json.message
        : `${provider} request failed (${status})`;
  return message;
}

function extractOpenAiOutputText(output: unknown): string {
  if (!Array.isArray(output)) return '';
  return output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function normalizeOpenAiUsage(usage: unknown): LlmUsage | undefined {
  if (!isRecord(usage)) return undefined;
  return {
    inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined,
    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined,
    totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
  };
}

function normalizeAnthropicUsage(usage: unknown): LlmUsage | undefined {
  if (!isRecord(usage)) return undefined;
  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined;
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      typeof inputTokens === 'number' || typeof outputTokens === 'number'
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined,
  };
}

function normalizeThrown(provider: LlmProvider | undefined, err: unknown): LlmServiceError {
  if (err instanceof LlmServiceError) return err;
  return new LlmServiceError(err instanceof Error ? err.message : String(err), {
    provider,
    retryClass: 'retryable',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function rememberError(error: LlmServiceError, experimentId?: string): Promise<void> {
  await setLastLlmError({
    experimentId,
    provider: error.provider,
    message: error.message,
    code: error.code,
    at: Date.now(),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
