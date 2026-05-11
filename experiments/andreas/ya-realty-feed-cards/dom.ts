export type Placement = 'auto' | 'top' | 'after_first_card';

type InsertionTarget = {
  parent: Element;
  before: Element | null;
};

const FEED_HINT_RE = /(feed|zen|stream|news|cards|grid|content)/i;
const SEARCH_HINT_RE = /(search|header|main)/i;

export function isYaHomePage(url: string): boolean {
  try {
    const parsed = new URL(url, location.origin);
    return (
      (parsed.hostname === 'ya.ru' || parsed.hostname === 'www.ya.ru') &&
      (parsed.pathname === '/' || parsed.pathname === '')
    );
  } catch {
    return false;
  }
}

export function observePage(
  callback: () => void,
  signal: AbortSignal,
  options: {
    ownSelector: string;
    isApplying: () => boolean;
  },
): () => void {
  let queued = false;
  const schedule = () => {
    if (queued || signal.aborted || options.isApplying()) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      if (signal.aborted || options.isApplying()) return;
      callback();
    }, 120);
  };

  const observer = new MutationObserver((mutations) => {
    if (options.isApplying()) return;
    if (mutations.every((mutation) => isOwnMutation(mutation, options.ownSelector))) return;
    schedule();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

export function isCurrentInsertion(
  module: Element,
  target: InsertionTarget,
  signature: string,
): boolean {
  return (
    module.parentElement === target.parent &&
    module.nextElementSibling === target.before &&
    module.getAttribute('data-crust-signature') === signature
  );
}

export function findInsertionTarget(root: Document, placement: Placement): InsertionTarget | null {
  const feed = findLikelyFeed(root);
  if (feed) {
    if (placement === 'top') return { parent: feed, before: firstVisibleChild(feed) };
    if (placement === 'after_first_card') {
      const first = firstVisibleChild(feed);
      return { parent: feed, before: first?.nextElementSibling ?? null };
    }
    return { parent: feed, before: secondVisibleChild(feed) ?? null };
  }

  const searchArea = findLikelySearchArea(root);
  if (searchArea?.parentElement) {
    return {
      parent: searchArea.parentElement,
      before: searchArea.nextElementSibling,
    };
  }

  return document.body ? { parent: document.body, before: document.body.firstElementChild } : null;
}

function findLikelyFeed(root: Document): Element | null {
  const explicit = Array.from(
    root.querySelectorAll('[data-testid*="feed" i], [class*="feed" i], [class*="zen" i]'),
  ).find(isUsefulContainer);
  if (explicit) return explicit;

  return Array.from(root.querySelectorAll('main, section, div'))
    .filter(isUsefulContainer)
    .sort((a, b) => feedScore(b) - feedScore(a))[0] ?? null;
}

function findLikelySearchArea(root: Document): Element | null {
  return Array.from(root.querySelectorAll('form, [role="search"], input, textarea, main, header'))
    .filter((element) => isVisible(element) && SEARCH_HINT_RE.test(signature(element)))
    .sort((a, b) => areaScore(b) - areaScore(a))[0] ?? null;
}

function isUsefulContainer(element: Element): boolean {
  if (!isVisible(element)) return false;

  const rect = element.getBoundingClientRect();
  const visibleChildren = Array.from(element.children).filter(isVisible);
  const links = element.querySelectorAll('a[href], button, article').length;

  return rect.width >= 260 && rect.height >= 120 && visibleChildren.length >= 2 && links >= 2;
}

function feedScore(element: Element): number {
  const rect = element.getBoundingClientRect();
  const visibleChildren = Array.from(element.children).filter(isVisible).length;
  const links = element.querySelectorAll('a[href], button, article').length;
  const hint = FEED_HINT_RE.test(signature(element)) ? 80 : 0;
  const belowSearch = rect.top > 120 ? 30 : 0;
  const width = Math.min(rect.width / 20, 50);
  return hint + belowSearch + visibleChildren * 6 + links * 2 + width;
}

function areaScore(element: Element): number {
  const rect = element.getBoundingClientRect();
  const hint = SEARCH_HINT_RE.test(signature(element)) ? 40 : 0;
  return hint + Math.max(0, 300 - rect.top) / 10 + Math.min(rect.width / 30, 30);
}

function firstVisibleChild(parent: Element): Element | null {
  return Array.from(parent.children).find(isVisible) ?? null;
}

function secondVisibleChild(parent: Element): Element | null {
  const visible = Array.from(parent.children).filter(isVisible);
  return visible[1] ?? null;
}

function isVisible(element: Element): boolean {
  if (element.matches('[data-crust-ya-realty-feed-cards]')) return false;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) !== 0
  );
}

function isOwnMutation(mutation: MutationRecord, ownSelector: string): boolean {
  return (
    isOwnNode(mutation.target, ownSelector) ||
    Array.from(mutation.addedNodes).some((node) => isOwnNode(node, ownSelector)) ||
    Array.from(mutation.removedNodes).some((node) => isOwnNode(node, ownSelector))
  );
}

function isOwnNode(node: Node, ownSelector: string): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(ownSelector) || Boolean(node.closest(ownSelector));
}

function signature(element: Element): string {
  return [
    element.tagName,
    element.id,
    element.className,
    element.getAttribute('role'),
    element.getAttribute('data-testid'),
    element.getAttribute('aria-label'),
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}
