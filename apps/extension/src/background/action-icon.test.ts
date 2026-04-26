import { describe, expect, it } from 'vitest';
import { setAppliedCountBadge } from './action-icon';

describe('setAppliedCountBadge', () => {
  it('clears the badge for count 0', async () => {
    await setAppliedCountBadge(7, 0);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '' });
  });

  it('sets the numeric count for 1-99', async () => {
    await setAppliedCountBadge(7, 5);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '5' });
  });

  it('caps large counts at 99+', async () => {
    await setAppliedCountBadge(7, 120);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '99+' });
  });
});
