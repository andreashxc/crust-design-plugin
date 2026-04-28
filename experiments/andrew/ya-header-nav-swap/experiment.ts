import type { ApplyFn } from '@platform/experiment-sdk';

const EXP_ID = 'andrew-ya-header-nav-swap';
const SEARCH_LABEL = 'поиск';
const ALICE_LABEL_RE = /(алиса|alice)/i;
const HEADER_NAV_ORIGINAL_ATTR = 'data-crust-ya-header-nav-swap-original-order';
const STYLE_ID = `${EXP_ID}-style`;

type NavPair = {
  parent: Element;
  searchItem: Element;
  aliceItem: Element;
};

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export const apply: ApplyFn = ({ tweaks, helpers, signal, currentURL, log }) => {
  const order = stringValue(tweaks.order, 'alice_first');
  const desiredOrder = order === 'search_first' ? 'search_first' : 'alice_first';
  const originalOrders = new WeakMap<Element, 'alice_first' | 'search_first'>();
  const style = injectStyle();

  let scheduled = false;

  const sync = () => {
    scheduled = false;
    if (signal.aborted || !isTargetPage(location.href || currentURL)) return;

    const pair = findNavPair(document);
    if (!pair) return;

    if (!originalOrders.has(pair.parent)) {
      originalOrders.set(pair.parent, storedOriginalOrder(pair.parent) ?? currentOrder(pair));
    }

    applyOrder(pair, desiredOrder);
    log(`${EXP_ID} applied`, { order: desiredOrder, parent: describeElement(pair.parent) });
  };

  const schedule = () => {
    if (scheduled || signal.aborted) return;
    scheduled = true;
    queueMicrotask(sync);
  };

  sync();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const removeUrlListener = helpers.onUrlChange(() => {
    schedule();
  });

  return () => {
    observer.disconnect();
    removeUrlListener();
    style.remove();

    for (const pair of findAllNavPairs(document)) {
      const originalOrder = originalOrders.get(pair.parent);
      if (originalOrder) applyOrder(pair, originalOrder);
    }
  };
};

function injectStyle(): HTMLStyleElement {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.dataset.expId = EXP_ID;
  style.textContent = `
    .HeaderNav-Tab[data-tid="alice_chat"],
    a.HeaderNav-Tab[href*="//ya.ru/alice?"],
    a.HeaderNav-Tab[href*="/alice/chat"] {
      transition: none !important;
      animation: none !important;
    }
    .HeaderNav-Tab[data-tid="www"],
    a.HeaderNav-Tab[href^="//ya.ru?source=tabbar"],
    a.HeaderNav-Tab[href*="/search/"] {
      transition: none !important;
      animation: none !important;
    }
  `;
  (document.head ?? document.documentElement).append(style);
  return style;
}

function isTargetPage(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return (
      pathname === '/search' ||
      pathname.startsWith('/search/') ||
      pathname === '/alice' ||
      pathname.startsWith('/alice/')
    );
  } catch {
    return false;
  }
}

function findNavPair(root: ParentNode): NavPair | null {
  return findKnownHeaderNavPair(root) ?? findAllNavPairs(root)[0] ?? null;
}

function findAllNavPairs(root: ParentNode): NavPair[] {
  const semanticCandidates = Array.from(
    root.querySelectorAll('a, button, [role="tab"], [role="link"], [aria-label]'),
  ).filter(isVisibleElement);
  const textCandidates = Array.from(root.querySelectorAll('*')).filter(isVisibleElement);
  const candidates = uniqueElements([...semanticCandidates, ...textCandidates]).filter(isLikelyHeaderNavText);

  const searchCandidates = candidates.filter(isSearchNavCandidate);
  const aliceCandidates = candidates.filter(isAliceNavCandidate);
  const pairs: NavPair[] = [];

  for (const search of searchCandidates) {
    for (const alice of aliceCandidates) {
      const pair = makeNavPair(search, alice);
      if (!pair) continue;
      if (!pairs.some((existing) => existing.parent === pair.parent)) {
        pairs.push(pair);
      }
    }
  }

  return pairs.sort((a, b) => navScore(b) - navScore(a));
}

function findKnownHeaderNavPair(root: ParentNode): NavPair | null {
  const search = root.querySelector(
    '.HeaderNav-Tab[data-tid="www"], a.HeaderNav-Tab[href^="//ya.ru?source=tabbar"]',
  );
  const alice = root.querySelector(
    '.HeaderNav-Tab[data-tid="alice_chat"], a.HeaderNav-Tab[href*="//ya.ru/alice?"]',
  );
  if (!search || !alice) return null;
  return makeNavPair(search, alice);
}

function makeNavPair(search: Element, alice: Element): NavPair | null {
  if (!isSameVisualRow(search, alice)) return null;

  const parent = nearestSharedParent(search, alice);
  if (!parent) return null;

  const searchItem = directChildUnder(parent, search);
  const aliceItem = directChildUnder(parent, alice);
  if (!searchItem || !aliceItem || searchItem === aliceItem) return null;

  const childCount = parent.children.length;
  if (childCount < 2 || childCount > 24) return null;

  return { parent, searchItem, aliceItem };
}

function nearestSharedParent(first: Element, second: Element): Element | null {
  let node: Element | null = first.parentElement;
  while (node) {
    if (node.contains(second)) return node;
    node = node.parentElement;
  }
  return null;
}

function directChildUnder(parent: Element, child: Element): Element | null {
  let node: Element | null = child;
  while (node.parentElement && node.parentElement !== parent) {
    node = node.parentElement;
  }
  return node.parentElement === parent ? node : null;
}

function applyOrder(pair: NavPair, order: 'alice_first' | 'search_first'): void {
  pair.searchItem.setAttribute('data-crust-nav-swap', 'search');
  pair.aliceItem.setAttribute('data-crust-nav-swap', 'alice');
  pair.parent.setAttribute(HEADER_NAV_ORIGINAL_ATTR, originalOrderForParent(pair.parent, pair));

  if (currentOrder(pair) === order) return;

  if (order === 'alice_first') {
    pair.parent.insertBefore(pair.aliceItem, pair.searchItem);
  } else {
    pair.parent.insertBefore(pair.searchItem, pair.aliceItem);
  }
}

function storedOriginalOrder(parent: Element): 'alice_first' | 'search_first' | null {
  const value = parent.getAttribute(HEADER_NAV_ORIGINAL_ATTR);
  return value === 'alice_first' || value === 'search_first' ? value : null;
}

function originalOrderForParent(
  parent: Element,
  pair: NavPair,
): 'alice_first' | 'search_first' {
  return storedOriginalOrder(parent) ?? currentOrder(pair);
}

function currentOrder(pair: NavPair): 'alice_first' | 'search_first' {
  const position = pair.searchItem.compareDocumentPosition(pair.aliceItem);
  return position & Node.DOCUMENT_POSITION_PRECEDING ? 'alice_first' : 'search_first';
}

function isSearchNavCandidate(element: Element): boolean {
  const label = normalizedLabel(element);
  if (label === SEARCH_LABEL) return !hasMatchingDescendant(element, isSearchNavCandidate);

  const href = element instanceof HTMLAnchorElement ? element.href : '';
  return label.includes(SEARCH_LABEL) && /\/search(?:\/|\?|$)/.test(href);
}

function isAliceNavCandidate(element: Element): boolean {
  const label = normalizedLabel(element);
  if (!ALICE_LABEL_RE.test(label)) return false;

  const href = element instanceof HTMLAnchorElement ? element.href : '';
  return (
    href.includes('/alice/chat/') ||
    href.includes('promo=force_neuro') ||
    href.includes('alice') ||
    (label.startsWith('алиса') && !hasMatchingDescendant(element, isAliceNavCandidate)) ||
    label === 'алиса' ||
    label === 'алисой алиса'
  );
}

function normalizedLabel(element: Element): string {
  const ariaLabel = element.getAttribute('aria-label') ?? '';
  const title = element.getAttribute('title') ?? '';
  return `${ariaLabel} ${title} ${element.textContent ?? ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isVisibleElement(element: Element): boolean {
  const box = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function isLikelyHeaderNavText(element: Element): boolean {
  const box = element.getBoundingClientRect();
  if (box.top < 0 || box.top > Math.min(360, window.innerHeight * 0.45)) return false;
  if (box.width > 260 || box.height > 80) return false;

  const label = normalizedLabel(element);
  return label === SEARCH_LABEL || label.startsWith('алиса') || label.includes('alice');
}

function isSameVisualRow(first: Element, second: Element): boolean {
  const firstBox = first.getBoundingClientRect();
  const secondBox = second.getBoundingClientRect();
  const topDelta = Math.abs(firstBox.top - secondBox.top);
  const centerDelta = Math.abs(
    firstBox.top + firstBox.height / 2 - (secondBox.top + secondBox.height / 2),
  );
  return topDelta <= 18 || centerDelta <= 18;
}

function hasMatchingDescendant(
  element: Element,
  predicate: (candidate: Element) => boolean,
): boolean {
  for (const child of Array.from(element.children)) {
    if (isVisibleElement(child) && predicate(child)) return true;
  }
  return false;
}

function uniqueElements(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

function navScore(pair: NavPair): number {
  let score = 0;
  const parentLabel = normalizedLabel(pair.parent);
  if (pair.parent.matches('nav, [role="navigation"], [role="tablist"]')) score += 4;
  if (parentLabel.includes(SEARCH_LABEL) && ALICE_LABEL_RE.test(parentLabel)) score += 2;
  if (pair.parent.closest('header')) score += 2;
  if (pair.parent.children.length <= 12) score += 1;
  return score;
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  const className = typeof element.className === 'string' ? element.className.trim() : '';
  return [tag, role ? `[role="${role}"]` : '', className ? `.${className.split(/\s+/).join('.')}` : '']
    .filter(Boolean)
    .join('');
}
