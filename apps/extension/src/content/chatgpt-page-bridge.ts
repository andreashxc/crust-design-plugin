import { onMessage } from '@/shared/messages';

const COMPOSER_SELECTORS = [
  '#prompt-textarea[contenteditable="true"]',
  '[role="textbox"][aria-label*="ChatGPT"]',
  '[contenteditable="true"][data-virtualkeyboard]',
];

export function registerChatGptPageBridge(): void {
  onMessage('CHATGPT_PAGE_RUN', async ({ data }) => {
    try {
      const text = await runPromptFlow(String(data.prompt || ''));
      return { ok: true, text };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'ChatGPT page automation failed.',
      };
    }
  });
}

export async function runPromptFlow(prompt: string): Promise<string> {
  const composer = await waitForChatGptComposer();
  const beforeText = getLatestAssistantText();

  if (!hasPrefilledPrompt(composer, prompt)) {
    setChatGptComposerText(composer, prompt);
  }

  await waitFor(() => {
    const button = findChatGptSendButton();
    return button && !button.disabled;
  }, 5_000);
  clickChatGptSend(composer);

  const messageNode = await waitForNewAssistantMessage(beforeText, 120_000);
  const text = await waitForAssistantMessageStable(messageNode, beforeText, 120_000);
  return cleanupChatGptAnswer(text);
}

export function hasPrefilledPrompt(composer: Element, prompt: string): boolean {
  const currentText = elementText(composer).replace(/\s+/g, ' ').trim();
  const targetText = prompt.replace(/\s+/g, ' ').trim();
  return Boolean(currentText) && currentText === targetText;
}

async function waitForChatGptComposer(timeoutMs = 20_000): Promise<HTMLElement> {
  return waitFor(() => {
    for (const selector of COMPOSER_SELECTORS) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) return element;
    }
    return null;
  }, timeoutMs);
}

function setChatGptComposerText(composer: HTMLElement, text: string): void {
  composer.focus();

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection.addRange(range);
  }

  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
  composer.textContent = '';

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  composer.append(paragraph);

  composer.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    }),
  );
  composer.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text,
    }),
  );
}

function findChatGptSendButton(): HTMLButtonElement | null {
  const exactButton = document.querySelector('#composer-submit-button');
  if (exactButton instanceof HTMLButtonElement && !exactButton.disabled) return exactButton;

  const candidates = Array.from(document.querySelectorAll('button'));
  return (
    candidates.find((button) => {
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('data-testid'),
        button.textContent,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        !button.disabled &&
        (label.includes('send prompt') ||
          label.includes('send') ||
          label.includes('submit') ||
          label.includes('отправить подсказку') ||
          label.includes('отправ'))
      );
    }) ?? null
  );
}

function clickChatGptSend(composer: HTMLElement): void {
  const sendButton = findChatGptSendButton();
  if (sendButton) {
    sendButton.click();
    return;
  }

  composer.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
    }),
  );
}

function getAssistantMessages(): Element[] {
  return Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
}

function buildAssistantSignature(node: Element): string {
  const id = node.getAttribute('data-message-id') || '';
  const text = extractNodeText(node).slice(0, 200);
  return `${id}::${text}`;
}

async function waitForNewAssistantMessage(beforeText: string, timeoutMs: number): Promise<Element> {
  const beforeSignature = buildAssistantSignature(
    getAssistantMessages().at(-1) || document.createElement('div'),
  );

  return waitFor(() => {
    const messages = getAssistantMessages();
    const last = messages[messages.length - 1];
    if (!last) return null;

    const signature = buildAssistantSignature(last);
    const text = extractNodeText(last).trim();
    const latestText = getLatestAssistantText();

    if (!signature || (signature === beforeSignature && latestText === beforeText)) return null;
    if (!text && !latestText) return null;

    return last;
  }, timeoutMs);
}

async function waitForAssistantMessageStable(
  node: Element,
  beforeText: string,
  timeoutMs: number,
): Promise<string> {
  const startedAt = Date.now();
  let previous = '';
  let stableSince = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const directText = extractNodeText(node).trim();
    const latestText = getLatestAssistantText();
    const current = pickBestAssistantText(directText, latestText, beforeText);
    const stillGenerating = isChatGptStillGenerating();
    const elapsed = Date.now() - startedAt;

    if (current && current === previous) {
      stableSince ||= Date.now();
      const stableForMs = Date.now() - stableSince;

      if (!stillGenerating && stableForMs > 1_200) return current;
      if (stillGenerating && stableForMs > 2_500 && elapsed > 4_000) return current;
    } else {
      stableSince = 0;
      previous = current;
    }

    if (current && elapsed > 15_000) return current;

    await sleep(500);
  }

  const fallback = pickBestAssistantText(
    extractNodeText(node).trim(),
    getLatestAssistantText(),
    beforeText,
  );
  if (fallback) return fallback;

  throw new Error('Timed out waiting for ChatGPT response.');
}

function extractNodeText(node: Element): string {
  const markdown = node.querySelector('.markdown');
  return elementText(markdown || node);
}

function getLatestAssistantText(): string {
  const messages = getAssistantMessages();

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const text = extractNodeText(message).trim();
    if (text) return text;
  }

  const markdownBlocks = Array.from(
    document.querySelectorAll('[data-message-author-role="assistant"] .markdown'),
  );
  for (let index = markdownBlocks.length - 1; index >= 0; index -= 1) {
    const block = markdownBlocks[index];
    if (!block) continue;
    const text = elementText(block).trim();
    if (text) return text;
  }

  return '';
}

export function pickBestAssistantText(
  directText: string,
  latestText: string,
  beforeText: string,
): string {
  const candidates = [directText, latestText].map((value) => value.trim()).filter(Boolean);
  for (const candidate of candidates) {
    if (candidate !== beforeText.trim()) return candidate;
  }
  return candidates[0] || '';
}

function isChatGptStillGenerating(): boolean {
  const selectors = [
    'button[aria-label*="Stop"]',
    'button[aria-label*="Стоп"]',
    'button[aria-label*="Останов"]',
    '[data-testid="stop-button"]',
  ];

  return selectors.some((selector) => document.querySelector(selector));
}

export function cleanupChatGptAnswer(text: string): string {
  return text
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function waitFor<T>(predicate: () => T | null | false, timeoutMs: number): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = predicate();
    if (result) return result;

    await sleep(250);
  }

  throw new Error('Timed out waiting for ChatGPT page element.');
}

function elementText(element: Element): string {
  return (element as HTMLElement).innerText || element.textContent || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
