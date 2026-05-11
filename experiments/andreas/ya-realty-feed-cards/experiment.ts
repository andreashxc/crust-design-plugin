import type { ApplyFn } from '@platform/experiment-sdk';
import { findInsertionTarget, isCurrentInsertion, isYaHomePage, observePage } from './dom';
import { extractRealtyCardsFromHtml, SNAPSHOT_REALTY_CARDS } from './realty-parser';
import { renderRealtyFeedCards, type Variant } from './renderer';
import { realtyFeedStyles } from './styles';

const EXP_ID = 'andreas-ya-realty-feed-cards';
const STYLE_ID = `${EXP_ID}-styles`;
const MODULE_ATTR = 'data-crust-ya-realty-feed-cards';
const MODULE_SELECTOR = `[${MODULE_ATTR}]`;
const SOURCE_URL = 'https://yandex.ru/realty/moskva_i_moskovskaya_oblast/kupit/kvartira?lr=213';

function variantValue(value: unknown): Variant {
  return value === 'conservative' || value === 'exploratory' ? value : 'balanced';
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function placementValue(value: unknown): 'auto' | 'top' | 'after_first_card' {
  return value === 'top' || value === 'after_first_card' ? value : 'auto';
}

export const apply: ApplyFn = async ({ helpers, tweaks, signal, currentURL, log }) => {
  if (!isYaHomePage(currentURL)) return () => {};

  const variant = variantValue(tweaks.variant);
  const showAnnotations = Boolean(tweaks.show_annotations ?? false);
  const placement = placementValue(tweaks.placement);
  const maxCards = Math.max(1, Math.min(6, Math.round(numberValue(tweaks.card_count, 3))));
  let cards = SNAPSHOT_REALTY_CARDS;
  let isApplying = false;

  helpers.injectStyle(realtyFeedStyles, { id: STYLE_ID });

  try {
    const response = await helpers.fetchPage(SOURCE_URL);
    if (!signal.aborted && response.ok) {
      const liveCards = extractRealtyCardsFromHtml(response.html, response.url);
      if (liveCards.length >= 3) cards = liveCards;
    }
  } catch (error) {
    log(`${EXP_ID}: live realty fetch failed, using snapshot`, error);
  }

  const sync = () => {
    if (signal.aborted || !isYaHomePage(location.href)) return;

    const target = findInsertionTarget(document, placement);
    if (!target) return;
    const visibleCards = cards.slice(0, maxCards);
    const signature = renderSignature({
      variant,
      maxCards,
      placement,
      showAnnotations,
      cards: visibleCards,
    });

    const existing = Array.from(document.querySelectorAll<HTMLElement>(MODULE_SELECTOR));
    if (existing && isCurrentInsertion(existing, target, signature)) return;

    const modules = renderRealtyFeedCards({
      cards: visibleCards,
      variant,
      showAnnotations,
    });
    modules.forEach((module, index) => {
      module.setAttribute(MODULE_ATTR, '');
      module.setAttribute('data-crust-signature', signature);
      module.setAttribute('data-crust-index', String(index));
    });

    isApplying = true;
    try {
      existing.forEach((module) => module.remove());
      const fragment = document.createDocumentFragment();
      modules.forEach((module) => fragment.append(module));
      target.parent.insertBefore(fragment, target.before);
    } finally {
      queueMicrotask(() => {
        isApplying = false;
      });
    }
  };

  const stopObserving = observePage(sync, signal, {
    ownSelector: MODULE_SELECTOR,
    isApplying: () => isApplying,
  });
  const stopUrlListener = helpers.onUrlChange(sync);
  sync();

  return () => {
    isApplying = true;
    stopObserving();
    stopUrlListener();
    document.querySelectorAll(MODULE_SELECTOR).forEach((module) => module.remove());
    isApplying = false;
  };
};

function renderSignature(args: {
  variant: Variant;
  maxCards: number;
  placement: string;
  showAnnotations: boolean;
  cards: Array<{ price: string; specs: string[]; building: string; href: string }>;
}): string {
  return JSON.stringify({
    variant: args.variant,
    cardCount: args.maxCards,
    placement: args.placement,
    showAnnotations: args.showAnnotations,
    cards: args.cards.map((card) => ({
      price: card.price,
      specs: card.specs,
      building: card.building,
      href: card.href,
    })),
  });
}
