import type { IconTheme } from '@/shared/messages';

const DARK_GLYPH_ICON = {
  16: 'icon/16.png',
  24: 'icon/24.png',
  32: 'icon/32.png',
} as const;

const LIGHT_GLYPH_ICON = {
  16: 'icon/16-light.png',
  24: 'icon/24-light.png',
  32: 'icon/32-light.png',
} as const;

export async function setActionIconTheme(theme: IconTheme): Promise<{ ok: true }> {
  if (!chrome.action?.setIcon) return { ok: true };
  await chrome.action.setIcon({
    path: theme === 'dark' ? LIGHT_GLYPH_ICON : DARK_GLYPH_ICON,
  });
  return { ok: true };
}

export async function setAppliedCountBadge(tabId: number, count: number): Promise<{ ok: true }> {
  if (!chrome.action?.setBadgeText) return { ok: true };
  await chrome.action.setBadgeText({
    tabId,
    text: count <= 0 ? '' : count > 99 ? '99+' : String(count),
  });
  return { ok: true };
}
