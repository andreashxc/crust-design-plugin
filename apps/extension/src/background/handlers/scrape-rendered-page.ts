import { scrapeRenderedPage } from '@/background/rendered-page';
import type { ProtocolMap } from '@/shared/messages';

export function handleScrapeRenderedPage(data: Parameters<ProtocolMap['SCRAPE_RENDERED_PAGE']>[0]) {
  return scrapeRenderedPage(data.url, data.options);
}
