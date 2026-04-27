import type { ApplyFn } from '@platform/experiment-sdk';

const EXP_ID = 'designer2-page-summary';

export const apply: ApplyFn = async ({ helpers, currentURL, signal }) => {
  helpers.injectStyle(
    `
      [data-exp-id="${EXP_ID}"] {
        position: fixed;
        right: 16px;
        top: 96px;
        z-index: 2147483647;
        width: 280px;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid #0891b2;
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
      }
      [data-exp-id="${EXP_ID}"] strong {
        display: block;
        margin-bottom: 4px;
        color: #0e7490;
      }
    `,
    { id: EXP_ID },
  );

  const node = document.createElement('aside');
  node.dataset.expId = EXP_ID;

  const title = document.createElement('strong');
  title.textContent = 'Page summary';
  node.append(title);

  const body = document.createElement('span');
  body.textContent = 'Fetching page metadata...';
  node.append(body);

  helpers.injectNode(node);

  const result = await helpers.fetchPage(currentURL);
  if (signal.aborted) return () => {};

  body.textContent = result.ok
    ? result.title || result.text.slice(0, 96) || 'Fetched page content'
    : `fetchPage: ${result.reason}`;

  return () => {};
};
