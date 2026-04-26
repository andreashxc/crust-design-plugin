import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPage } from './fetch-page';

function response(
  body: string,
  init: { ok?: boolean; status?: number; contentType?: string } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers({ 'content-type': init.contentType ?? 'text/html; charset=utf-8' }),
    text: async () => body,
  } as Response;
}

describe('fetchPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches and parses SSR HTML', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        '<html><head><title>T</title></head><body><main><h1>Hello</h1><p>Enough meaningful text for SSR content.</p></main></body></html>',
      ),
    );

    await expect(fetchPage('https://ya.ru/page')).resolves.toMatchObject({
      ok: true,
      url: 'https://ya.ru/page',
      title: 'T',
      text: 'Hello Enough meaningful text for SSR content.',
    });
  });

  it('rejects non-http urls and non-html responses', async () => {
    await expect(fetchPage('chrome://extensions')).resolves.toMatchObject({
      ok: false,
      reason: 'network_error',
    });

    vi.mocked(fetch).mockResolvedValueOnce(response('{}', { contentType: 'application/json' }));
    await expect(fetchPage('https://ya.ru/api')).resolves.toMatchObject({
      ok: false,
      reason: 'not_html',
    });
  });

  it('returns selector_not_found when selector is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response('<body><main>Content with enough text to not shell.</main></body>'),
    );
    await expect(fetchPage('https://ya.ru/page', '.missing')).resolves.toMatchObject({
      ok: false,
      reason: 'selector_not_found',
    });
  });

  it('detects likely SPA shells', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        '<body><div id="root"></div><script></script><script></script><script></script></body>',
      ),
    );
    await expect(fetchPage('https://app.example/')).resolves.toMatchObject({
      ok: false,
      reason: 'likely_spa_shell',
    });
  });
});
