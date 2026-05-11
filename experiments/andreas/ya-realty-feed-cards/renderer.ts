export type Variant = 'conservative' | 'balanced' | 'exploratory';

export type RealtyCard = {
  price: string;
  pricePerMeter: string;
  location: string;
  commute: string;
  specs: string[];
  building: string;
  extra: string;
  source: string;
  tag: string;
  href: string;
  imageUrl?: string;
};

type RenderOptions = {
  cards: RealtyCard[];
  variant: Variant;
  showAnnotations: boolean;
};

export function renderRealtyFeedCards(options: RenderOptions): HTMLElement[] {
  return options.cards.map((card, index) =>
    renderFeedCard({
      card,
      index,
      variant: options.variant,
      showAnnotation: options.showAnnotations && index === 0,
    }),
  );
}

function renderFeedCard(args: {
  card: RealtyCard;
  index: number;
  variant: Variant;
  showAnnotation: boolean;
}): HTMLElement {
  const { card, index, variant, showAnnotation } = args;
  const root = document.createElement('article');
  root.className = `yrfc-feed-card yrfc-feed-card--${variant}`;
  root.setAttribute('aria-label', `${card.specs.join(', ')}, ${card.price}, ${card.location}`);

  const link = document.createElement('a');
  link.className = 'yrfc-feed-card__link';
  link.href = card.href;
  link.rel = 'noopener';

  const media = document.createElement('div');
  media.className = 'yrfc-feed-card__media';
  media.setAttribute('aria-hidden', card.imageUrl ? 'false' : 'true');

  if (card.imageUrl) {
    const image = document.createElement('img');
    image.className = 'yrfc-feed-card__image';
    image.src = card.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image);
  } else {
    const shape = document.createElement('div');
    shape.className = `yrfc-feed-card__placeholder yrfc-feed-card__placeholder--${(index % 4) + 1}`;
    media.append(shape);
  }

  const tag = document.createElement('span');
  tag.className = 'yrfc-feed-card__tag';
  tag.textContent = card.tag;
  media.append(tag);
  link.append(media);

  const body = document.createElement('div');
  body.className = 'yrfc-feed-card__body';
  appendText(body, 'div', 'yrfc-feed-card__title', card.specs.join(' · '));

  const price = document.createElement('div');
  price.className = 'yrfc-feed-card__price-row';
  appendText(price, 'strong', 'yrfc-feed-card__price', card.price);
  appendText(price, 'span', 'yrfc-feed-card__meter', card.pricePerMeter);
  body.append(price);

  appendText(
    body,
    'div',
    'yrfc-feed-card__meta',
    [card.building, card.extra].filter(Boolean).join(' · '),
  );
  appendText(
    body,
    'div',
    'yrfc-feed-card__metro',
    [card.location, card.commute].filter(Boolean).join(' · '),
  );
  link.append(body);
  root.append(link);

  const source = document.createElement('div');
  source.className = 'yrfc-feed-card__source-row';
  appendText(source, 'span', 'yrfc-feed-card__service-mark', 'Я');
  appendText(source, 'span', 'yrfc-feed-card__service', 'Яндекс Недвижимость');
  root.append(source);

  if (showAnnotation) {
    const note = document.createElement('div');
    note.className = 'yrfc-feed-card__annotation';
    note.textContent = 'Hummer: отдельная карточка объекта, вставленная как соседний feed item.';
    root.append(note);
  }

  return root;
}

function appendText<TName extends keyof HTMLElementTagNameMap>(
  parent: Element,
  tagName: TName,
  className: string,
  textContent: string,
): HTMLElementTagNameMap[TName] {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = textContent;
  parent.append(node);
  return node;
}
