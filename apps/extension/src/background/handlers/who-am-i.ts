import type { WhoAmIResult } from '@/shared/messages';

/**
 * WHO_AM_I handler (Blocker 2 fix; checker iteration 1).
 *
 * Returns the calling tab's id from the chrome.runtime.MessageSender envelope.
 * Content scripts call this during bootstrap so they can write applied:<tabId>
 * BEFORE the first STATE_CHANGED broadcast (which only fires on toggle events
 * — without WHO_AM_I, applied:<tabId> would be empty on initial page load and
 * the popup status badge would never show "Applied").
 *
 * Throws when called outside a tab context (e.g., from the popup or options
 * page); @webext-core/messaging propagates the throw as a rejected promise to
 * the caller, so the callsite can decide whether to fall back.
 */
export type WhoAmIEnvelope = {
  sender: chrome.runtime.MessageSender;
};

export function handleWhoAmI(envelope: WhoAmIEnvelope): WhoAmIResult {
  const tabId = envelope.sender.tab?.id;
  if (typeof tabId !== 'number') {
    throw new Error('[bg] WHO_AM_I called outside a tab context');
  }
  return { tabId };
}
