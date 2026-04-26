import type { FetchPageResult } from '@platform/experiment-sdk';

const MAX_HTML_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function fetchPage(url: string, selector?: string): Promise<FetchPageResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, url, reason: 'network_error', message: 'Invalid URL' };
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { ok: false, url, reason: 'network_error', message: 'Only http(s) URLs are supported' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsedUrl.toString(), { signal: controller.signal });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok) {
      return {
        ok: false,
        url: parsedUrl.toString(),
        reason: 'network_error',
        message: `Request failed with ${response.status}`,
      };
    }
    if (!contentType.includes('text/html')) {
      return {
        ok: false,
        url: parsedUrl.toString(),
        reason: 'not_html',
        message: `Expected HTML, got ${contentType || 'unknown content type'}`,
      };
    }
    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return {
        ok: false,
        url: parsedUrl.toString(),
        reason: 'too_large',
        message: `HTML is larger than ${MAX_HTML_BYTES} bytes`,
      };
    }
    return parseFetchedHtml(html, parsedUrl.toString(), selector);
  } catch (err) {
    return {
      ok: false,
      url: parsedUrl.toString(),
      reason: 'network_error',
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseFetchedHtml(
  html: string,
  url: string,
  selector?: string,
): Promise<FetchPageResult> {
  if (typeof DOMParser !== 'undefined') return parseHtmlDocument(html, url, selector);

  const offscreen = await parseViaOffscreen(html, url, selector).catch(() => undefined);
  if (offscreen) return offscreen;

  return parseHtmlFallback(html, url, selector);
}

export function parseHtmlDocument(html: string, url: string, selector?: string): FetchPageResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.title || undefined;
  const target = selector ? doc.querySelector(selector) : doc.body;
  if (selector && !target) {
    return {
      ok: false,
      url,
      reason: 'selector_not_found',
      message: `Selector not found: ${selector}`,
    };
  }
  const targetHtml = target?.innerHTML ?? '';
  const text = normalizeText(target?.textContent ?? doc.body?.textContent ?? '');
  if (isLikelySpaShell(html, text)) {
    return {
      ok: false,
      url,
      reason: 'likely_spa_shell',
      message: 'Fetched HTML looks like a client-rendered shell',
    };
  }
  return { ok: true, url, html: targetHtml, text, title, selector };
}

function parseHtmlFallback(html: string, url: string, selector?: string): FetchPageResult {
  if (selector) {
    return {
      ok: false,
      url,
      reason: 'selector_not_found',
      message: 'Selector parsing requires DOMParser',
    };
  }
  const title = /<title[^>]*>(.*?)<\/title>/is.exec(html)?.[1]?.trim();
  const body = /<body[^>]*>(.*?)<\/body>/is.exec(html)?.[1] ?? html;
  const text = normalizeText(
    body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '),
  );
  if (isLikelySpaShell(html, text)) {
    return {
      ok: false,
      url,
      reason: 'likely_spa_shell',
      message: 'Fetched HTML looks like a client-rendered shell',
    };
  }
  return { ok: true, url, html: body, text, title };
}

async function parseViaOffscreen(
  html: string,
  url: string,
  selector?: string,
): Promise<FetchPageResult | undefined> {
  const chromeWithOffscreen = chrome as typeof chrome & {
    offscreen?: {
      createDocument(args: {
        url: string;
        reasons: string[];
        justification: string;
      }): Promise<void>;
    };
    runtime: typeof chrome.runtime & {
      getContexts?: (args: {
        contextTypes: string[];
        documentUrls: string[];
      }) => Promise<Array<{ documentUrl?: string }>>;
    };
  };
  if (!chromeWithOffscreen.offscreen?.createDocument || !chromeWithOffscreen.runtime.getContexts) {
    return undefined;
  }

  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const contexts = await chromeWithOffscreen.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });
  if (contexts.length === 0) {
    await chromeWithOffscreen.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse fetched HTML for Crust fetchPage helper',
    });
  }

  return chrome.runtime.sendMessage({
    name: 'OFFSCREEN_PARSE_PAGE',
    html,
    url,
    selector,
  }) as Promise<FetchPageResult>;
}

function isLikelySpaShell(html: string, text: string): boolean {
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const rootOnly = /<div[^>]+id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i.test(html);
  return text.length < 80 && (rootOnly || scriptCount >= 3);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
