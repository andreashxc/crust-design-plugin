import { sendMessage } from '@/shared/messages';

export function syncActionIconWithColorScheme(): () => void {
  if (!globalThis.matchMedia) return () => {};

  const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
  const publish = () => {
    void sendMessage('ICON_THEME_CHANGED', { theme: media.matches ? 'dark' : 'light' }).catch(
      () => {},
    );
  };

  publish();
  media.addEventListener('change', publish);
  return () => media.removeEventListener('change', publish);
}
