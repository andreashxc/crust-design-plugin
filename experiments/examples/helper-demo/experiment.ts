import type { ApplyFn } from '@platform/experiment-sdk';

export const apply: ApplyFn = async ({ helpers, signal }) => {
  helpers.injectStyle(`
    [data-exp-id="helper-demo"] {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: 260px;
      border: 1px solid #3b82f6;
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      padding: 12px;
      font: 13px/1.4 system-ui, sans-serif;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
    }
    [data-exp-id="helper-demo"] strong {
      display: block;
      margin-bottom: 4px;
      color: #1d4ed8;
    }
  `);

  const node = document.createElement('aside');
  node.dataset.expId = 'helper-demo';
  node.innerHTML = '<strong>Helper demo</strong><span>Loading helper result...</span>';
  helpers.injectNode(node);

  try {
    const page = await helpers.fetchPage(location.href);
    if (signal.aborted) return () => {};

    const prompt = `Write a short UI label for this page title: ${
      page.ok ? page.title || page.text.slice(0, 80) : page.reason
    }`;
    const label = await helpers.llm(prompt, { cacheKey: 'helper-demo-label' });
    if (signal.aborted) return () => {};

    node.innerHTML = `<strong>Helper demo</strong><span>${escapeHtml(label)}</span>`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    node.innerHTML = `<strong>Helper demo</strong><span>${escapeHtml(message)}</span>`;
  }

  return () => {};
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const escapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return escapes[char] ?? char;
  });
}
