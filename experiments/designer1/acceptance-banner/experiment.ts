import type { ApplyFn } from '@platform/experiment-sdk';

const EXP_ID = 'designer1-acceptance-banner';

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export const apply: ApplyFn = ({ tweaks, helpers, currentURL }) => {
  const headline = stringValue(tweaks.headline, 'Designer1 acceptance banner');
  const density = stringValue(tweaks.density, 'compact');
  const accent = stringValue(tweaks.accent, '#2563eb');
  const showTimestamp = booleanValue(tweaks.show_timestamp, true);
  const padding = density === 'comfortable' ? '14px 16px' : '9px 12px';

  helpers.injectStyle(
    `
      [data-exp-id="${EXP_ID}"] {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 2147483647;
        max-width: min(360px, calc(100vw - 32px));
        box-sizing: border-box;
        padding: ${padding};
        border: 1px solid ${accent};
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        font: 13px/1.4 system-ui, sans-serif;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
      }
      [data-exp-id="${EXP_ID}"] strong {
        display: block;
        margin-bottom: 4px;
        color: ${accent};
      }
    `,
    { id: EXP_ID },
  );

  const node = document.createElement('aside');
  node.dataset.expId = EXP_ID;
  node.setAttribute('role', 'status');

  const title = document.createElement('strong');
  title.textContent = headline;
  node.append(title);

  const body = document.createElement('span');
  body.textContent = showTimestamp
    ? `Applied to ${new URL(currentURL).hostname} at ${new Date().toLocaleTimeString()}`
    : `Applied to ${new URL(currentURL).hostname}`;
  node.append(body);

  helpers.injectNode(node);
  return () => {};
};
