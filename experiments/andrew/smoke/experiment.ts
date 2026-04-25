import type { ApplyFn } from '@platform/experiment-sdk';

export const apply: ApplyFn = ({ log }) => {
  const style = document.createElement('style');
  style.dataset.expId = 'smoke';
  style.textContent = 'body { background: pink !important; }';
  document.head.append(style);
  log('smoke applied');
  return () => {
    style.remove();
    log('smoke cleaned up');
  };
};
