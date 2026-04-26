import { fetchPage } from '@/background/fetch-page';
import type { ProtocolMap } from '@/shared/messages';

export function handleFetchPage(data: Parameters<ProtocolMap['FETCH_PAGE']>[0]) {
  return fetchPage(data.url, data.selector);
}
