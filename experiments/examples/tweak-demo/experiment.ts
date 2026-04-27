import type { ApplyFn } from '@platform/experiment-sdk';

const EXP_ID = 'tweak-demo';

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : fallback;
}

export const apply: ApplyFn = ({ tweaks, currentURL, log }) => {
  const position = stringValue(tweaks.position, 'top');
  const headline = stringValue(tweaks.headline, 'Tweak demo is active');
  const scale = numberValue(tweaks.scale, 100);
  const accent = stringValue(tweaks.accent, '#ff3366');
  const details = stringArrayValue(tweaks.details, ['url', 'badge']);

  const style = document.createElement('style');
  style.dataset.expId = EXP_ID;
  style.textContent = `
    [data-exp-id="${EXP_ID}"] {
      position: fixed;
      ${position === 'bottom' ? 'bottom: 16px;' : 'top: 16px;'}
      left: 50%;
      z-index: 2147483647;
      transform: translateX(-50%) scale(${scale / 100});
      transform-origin: ${position === 'bottom' ? 'bottom center' : 'top center'};
      max-width: min(720px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 14px 18px;
      border: 2px solid ${accent};
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      font: 14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
    }
    [data-exp-id="${EXP_ID}"] strong {
      display: block;
      margin-bottom: 4px;
      color: ${accent};
      font-size: 16px;
    }
    [data-exp-id="${EXP_ID}"] ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
  `;

  const banner = document.createElement('aside');
  banner.dataset.expId = EXP_ID;
  banner.setAttribute('role', 'status');

  const title = document.createElement('strong');
  title.textContent = headline;
  banner.append(title);

  const summary = document.createElement('div');
  summary.textContent = `Position: ${position}; scale: ${scale}%; accent: ${accent}`;
  banner.append(summary);

  if (details.length > 0) {
    const list = document.createElement('ul');
    for (const detail of details) {
      const item = document.createElement('li');
      if (detail === 'url') item.textContent = `URL: ${currentURL}`;
      if (detail === 'time') item.textContent = `Applied: ${new Date().toLocaleTimeString()}`;
      if (detail === 'badge') item.textContent = 'Badge: Phase 3 reference';
      list.append(item);
    }
    banner.append(list);
  }

  document.head.append(style);
  document.body.append(banner);

  log('tweak-demo applied', tweaks);

  return () => {
    banner.remove();
    style.remove();
    log('tweak-demo cleaned up');
  };
};
