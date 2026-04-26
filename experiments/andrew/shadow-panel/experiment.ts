import type { ApplyFn } from '@platform/experiment-sdk';

const HOST_ID = 'andrew-shadow-panel-host';

export const apply: ApplyFn = ({ currentURL, log }) => {
  const host = document.createElement('div');
  host.id = HOST_ID;

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      color-scheme: light;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .panel {
      width: min(320px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 14px;
      border: 1px solid #2563eb;
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.28);
    }
    .title {
      margin: 0 0 6px;
      color: #1d4ed8;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.3;
    }
    .body {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 13px;
      line-height: 1.4;
    }
  `;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'Shadow DOM reference panel');

  const title = document.createElement('h2');
  title.className = 'title';
  title.textContent = 'Shadow panel';

  const body = document.createElement('p');
  body.className = 'body';
  body.textContent = `Rendered inside a ShadowRoot for ${currentURL}`;

  panel.append(title, body);
  shadowRoot.append(style, panel);
  document.body.append(host);

  log('shadow-panel applied');

  return () => {
    host.remove();
    log('shadow-panel cleaned up');
  };
};
