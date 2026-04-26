import { clearLlmRuntimeCache, testProvider } from '@/background/llm/service';
import type { ProtocolMap } from '@/shared/messages';
import { resetLlmSessionStats } from '@/shared/storage';

export function handleProviderTest(data: Parameters<ProtocolMap['PROVIDER_TEST']>[0]) {
  return testProvider(data.provider);
}

export async function handleLlmClearCache(): Promise<{ ok: true }> {
  return clearLlmRuntimeCache();
}

export async function handleLlmResetSession(): Promise<{ ok: true }> {
  await resetLlmSessionStats();
  return { ok: true };
}
