import { describe, expect, it } from 'vitest';
import { handleWhoAmI } from './who-am-i';

describe('handleWhoAmI (Blocker 2 fix — content-script bootstrap tab id)', () => {
  it('returns {tabId} from envelope.sender.tab.id', () => {
    const result = handleWhoAmI({
      sender: {
        tab: { id: 42 } as chrome.tabs.Tab,
      } as chrome.runtime.MessageSender,
    });
    expect(result).toEqual({ tabId: 42 });
  });

  it('throws when envelope.sender.tab is undefined (popup / options call)', () => {
    expect(() =>
      handleWhoAmI({
        sender: {} as chrome.runtime.MessageSender,
      }),
    ).toThrow(/outside a tab context/);
  });

  it('throws when envelope.sender.tab exists but has no id', () => {
    expect(() =>
      handleWhoAmI({
        sender: {
          tab: {} as chrome.tabs.Tab,
        } as chrome.runtime.MessageSender,
      }),
    ).toThrow(/outside a tab context/);
  });
});
