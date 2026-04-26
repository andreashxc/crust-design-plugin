type UrlChangeCallback = (url: string) => void;

type UrlChangeInstall = {
  callbacks: Set<UrlChangeCallback>;
  lastUrl: string;
  cleanup: () => void;
};

let install: UrlChangeInstall | undefined;

export function createUrlChangeWatcher(
  callback: UrlChangeCallback,
  targetWindow: Window = window,
): () => void {
  if (!install) install = installUrlChangeWatcher(targetWindow);
  install.callbacks.add(callback);

  return () => {
    if (!install) return;
    install.callbacks.delete(callback);
    if (install.callbacks.size > 0) return;
    install.cleanup();
    install = undefined;
  };
}

function installUrlChangeWatcher(targetWindow: Window): UrlChangeInstall {
  const callbacks = new Set<UrlChangeCallback>();
  const targetHistory = targetWindow.history;
  const originalPushState = targetHistory.pushState;
  const originalReplaceState = targetHistory.replaceState;
  const state: UrlChangeInstall = {
    callbacks,
    lastUrl: targetWindow.location.href,
    cleanup: () => {},
  };

  const emitIfChanged = () => {
    const nextUrl = targetWindow.location.href;
    if (nextUrl === state.lastUrl) return;
    state.lastUrl = nextUrl;
    for (const listener of callbacks) listener(nextUrl);
  };

  const onNavigation = () => emitIfChanged();

  targetHistory.pushState = function pushState(
    this: History,
    ...params: Parameters<History['pushState']>
  ) {
    const result = originalPushState.apply(this, params);
    emitIfChanged();
    return result;
  };

  targetHistory.replaceState = function replaceState(
    this: History,
    ...params: Parameters<History['replaceState']>
  ) {
    const result = originalReplaceState.apply(this, params);
    emitIfChanged();
    return result;
  };

  targetWindow.addEventListener('popstate', onNavigation);
  targetWindow.addEventListener('hashchange', onNavigation);

  state.cleanup = () => {
    targetWindow.removeEventListener('popstate', onNavigation);
    targetWindow.removeEventListener('hashchange', onNavigation);
    if (targetHistory.pushState !== originalPushState) targetHistory.pushState = originalPushState;
    if (targetHistory.replaceState !== originalReplaceState) {
      targetHistory.replaceState = originalReplaceState;
    }
  };

  return state;
}
