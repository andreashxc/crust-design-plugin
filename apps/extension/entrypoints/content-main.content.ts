import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['*://*.ya.ru/*', '*://ya.ru/*'],
  runAt: 'document_idle',
  world: 'MAIN',
  main: () => {
    // MAIN-world scripts cannot access chrome.* APIs. Isolated world owns
    // registry loading until a window.postMessage bridge is added for MAIN experiments.
  },
});
