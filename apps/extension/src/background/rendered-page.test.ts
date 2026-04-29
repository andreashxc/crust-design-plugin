import { describe, expect, it, vi } from 'vitest';
import { scrapeRenderedPage } from './rendered-page';

describe('scrapeRenderedPage', () => {
  it('opens an inactive tab, executes a DOM collector, then closes the tab', async () => {
    chrome.tabs.create = vi.fn(async () => ({ id: 41, status: 'complete' }));
    chrome.scripting.executeScript = vi.fn(async () => [
      {
        result: {
          ok: true,
          url: 'https://yandex.ru/search?text=test',
          title: 'Search',
          html: '<main>products</main>',
          text: 'products',
        },
      },
    ]);

    await expect(scrapeRenderedPage('https://yandex.ru/search?text=test')).resolves.toEqual({
      ok: true,
      url: 'https://yandex.ru/search?text=test',
      title: 'Search',
      html: '<main>products</main>',
      text: 'products',
    });

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://yandex.ru/search?text=test',
      active: false,
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 41 },
        args: [null, 900_000],
      }),
    );
    expect(chrome.tabs.remove).toHaveBeenCalledWith(41);
  });

  it('passes a custom rendered HTML limit to the collector', async () => {
    chrome.tabs.create = vi.fn(async () => ({ id: 42, status: 'complete' }));
    chrome.scripting.executeScript = vi.fn(async () => [
      {
        result: {
          ok: true,
          url: 'https://yandex.ru/search?text=test',
          title: 'Search',
          html: '<main>products</main>',
          text: 'products',
        },
      },
    ]);

    await scrapeRenderedPage('https://yandex.ru/search?text=test', { maxHtmlChars: 2_500_000 });

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [null, 2_500_000],
      }),
    );
  });

  it('returns an error for invalid URLs without opening a tab', async () => {
    chrome.tabs.create = vi.fn();

    await expect(scrapeRenderedPage('nope')).resolves.toMatchObject({
      ok: false,
      error: 'Invalid URL',
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });
});
