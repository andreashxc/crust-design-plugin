import type { ApplyFn } from '@platform/experiment-sdk';

const EXP_ID = 'designer3-ai-label';

export const apply: ApplyFn = async ({ helpers, currentURL, signal }) => {
  helpers.injectStyle(
    `
      [data-exp-id="${EXP_ID}"] {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: 280px;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid #7c3aed;
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
      }
      [data-exp-id="${EXP_ID}"] strong {
        display: block;
        margin-bottom: 4px;
        color: #6d28d9;
      }
    `,
    { id: EXP_ID },
  );

  const node = document.createElement('aside');
  node.dataset.expId = EXP_ID;

  const title = document.createElement('strong');
  title.textContent = 'AI label';
  node.append(title);

  const body = document.createElement('span');
  body.textContent = 'Waiting for LLM result...';
  node.append(body);

  helpers.injectNode(node);

  try {
    const label = await helpers.llm(`Write a concise UI label for ${currentURL}`, {
      cacheKey: 'designer3-ai-label',
      maxOutputTokens: 48,
    });
    if (signal.aborted) return () => {};
    body.textContent = label;
  } catch (err) {
    body.textContent = err instanceof Error ? err.message : String(err);
  }

  return () => {};
};
