import { parseHtmlDocument } from '@/background/fetch-page';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const data = message as { name?: string; html?: string; url?: string; selector?: string };
  if (data?.name !== 'OFFSCREEN_PARSE_PAGE' || !data.html || !data.url) return false;

  try {
    sendResponse(parseHtmlDocument(data.html, data.url, data.selector));
  } catch (err) {
    sendResponse({
      ok: false,
      url: data.url,
      reason: 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return true;
});
