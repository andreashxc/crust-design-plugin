import { completeLlm } from '@/background/llm/service';
import type { LlmCompleteRequest } from '@/shared/messages';

export function handleLlmComplete(data: LlmCompleteRequest) {
  return completeLlm(data);
}
