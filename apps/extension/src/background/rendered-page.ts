import type { ScrapeRenderedPageOptions, ScrapeRenderedPageResult } from '@platform/experiment-sdk';

const DEFAULT_LOAD_TIMEOUT_MS = 20_000;
const DEFAULT_WAIT_MS = 900;
const MAX_HTML_CHARS = 900_000;

export async function scrapeRenderedPage(
  url: string,
  options: ScrapeRenderedPageOptions = {},
): Promise<ScrapeRenderedPageResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, url, error: 'Invalid URL' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, url: parsedUrl.toString(), error: 'Only http(s) URLs are supported' };
  }

  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: parsedUrl.toString(), active: false });
    tabId = tab.id;
    if (typeof tabId !== 'number') throw new Error('Failed to open rendered scrape tab.');

    await waitForTabComplete(tabId, options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS);
    await sleep(Math.max(0, options.waitMs ?? DEFAULT_WAIT_MS));

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: collectRenderedPage,
      args: [options.selector, MAX_HTML_CHARS],
    });
    const result = injection?.result;

    if (!result?.ok) {
      return {
        ok: false,
        url: parsedUrl.toString(),
        error: result?.error ?? 'Rendered page collection failed.',
      };
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      url: parsedUrl.toString(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (typeof tabId === 'number') {
      await chrome.tabs.remove(tabId).catch(() => undefined);
    }
  }
}

async function waitForTabComplete(tabId: number, timeoutMs: number): Promise<void> {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === 'complete') return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Rendered page did not finish loading.'));
    }, timeoutMs);

    function onUpdated(updatedTabId: number, changeInfo: { status?: string }) {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function collectRenderedPage(selector?: string, maxHtmlChars = 900_000): ScrapeRenderedPageResult {
  const target = selector ? document.querySelector(selector) : document.documentElement;
  if (!target) {
    return { ok: false, url: location.href, error: `Selector not found: ${selector}` };
  }

  const html =
    target instanceof HTMLElement ? target.outerHTML : document.documentElement.outerHTML;
  if (html.length > maxHtmlChars) {
    return { ok: false, url: location.href, error: `Rendered HTML is larger than ${maxHtmlChars}` };
  }

  return {
    ok: true,
    url: location.href,
    title: document.title,
    html,
    text: (target.textContent || '').replace(/\s+/g, ' ').trim(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
