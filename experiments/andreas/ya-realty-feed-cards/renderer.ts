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
  id: string;
  cards: RealtyCard[];
  variant: Variant;
  showAnnotations: boolean;
  sourceUrl: string;
};

const VARIANT_COPY: Record<Variant, { kicker: string; title: string; action: string }> = {
  conservative: {
    kicker: 'Недвижимость',
    title: 'Квартира из Яндекс Недвижимости',
    action: 'Смотреть',
  },
  balanced: {
    kicker: 'Недвижимость',
    title: 'Квартиры из свежей выдачи',
    action: 'Смотреть квартиры',
  },
  exploratory: {
    kicker: 'Яндекс Недвижимость',
    title: 'Объекты из поиска недвижимости',
    action: 'Открыть подборку',
  },
};

export function renderRealtyModule(options: RenderOptions): HTMLElement {
  const { id, cards, variant, showAnnotations, sourceUrl } = options;
  const copy = VARIANT_COPY[variant];
  const module = document.createElement('section');
  module.id = id;
  module.className = `yrfc yrfc--${variant}`;
  module.setAttribute('aria-label', 'Подборка квартир Яндекс Недвижимости');

  const header = document.createElement('div');
  header.className = 'yrfc__header';

  const text = document.createElement('div');
  text.className = 'yrfc__intro';
  appendText(text, 'div', 'yrfc__kicker', copy.kicker);
  appendText(text, 'h2', 'yrfc__title', copy.title);

  const cta = document.createElement('a');
  cta.className = 'yrfc__cta';
  cta.href = sourceUrl;
  cta.textContent = copy.action;
  cta.rel = 'noopener';

  header.append(text, cta);
  module.append(header);

  const grid = document.createElement('div');
  grid.className = 'yrfc__grid';
  for (const [index, card] of cards.entries()) {
    grid.append(renderCard(card, index, variant));
  }
  module.append(grid);

  if (showAnnotations) {
    const note = document.createElement('div');
    note.className = 'yrfc__annotation';
    note.textContent =
      'Hummer: balanced показывает 3 компактные карточки в формате фида; conservative снижает вмешательство, exploratory усиливает недвижимость как отдельный блок.';
    module.append(note);
  }

  return module;
}

function renderCard(card: RealtyCard, index: number, variant: Variant): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'yrfc-card';
  link.href = card.href;
  link.rel = 'noopener';
  link.setAttribute('aria-label', `${card.specs.join(', ')}, ${card.price}, ${card.location}`);

  const media = document.createElement('div');
  media.className = 'yrfc-card__media';
  media.setAttribute('aria-hidden', card.imageUrl ? 'false' : 'true');

  if (card.imageUrl) {
    const image = document.createElement('img');
    image.className = 'yrfc-card__image';
    image.src = card.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image);
  } else {
    const shape = document.createElement('div');
    shape.className = `yrfc-card__shape yrfc-card__shape--${(index % 4) + 1}`;
    media.append(shape);
  }

  const tag = document.createElement('span');
  tag.className = 'yrfc-card__tag';
  tag.textContent = card.tag;
  media.append(tag);

  const body = document.createElement('div');
  body.className = 'yrfc-card__body';

  const priceRow = document.createElement('div');
  priceRow.className = 'yrfc-card__price-row';
  appendText(priceRow, 'strong', 'yrfc-card__price', card.price);
  appendText(priceRow, 'span', 'yrfc-card__meter', card.pricePerMeter);
  body.append(priceRow);

  appendText(body, 'div', 'yrfc-card__title', card.specs.join(' · '));
  appendText(body, 'div', 'yrfc-card__meta', [card.building, card.extra].filter(Boolean).join(' · '));

  const footer = document.createElement('div');
  footer.className = 'yrfc-card__footer';
  appendText(
    footer,
    'span',
    'yrfc-card__metro',
    [card.location, card.commute].filter(Boolean).join(' · '),
  );
  if (variant !== 'conservative') appendText(footer, 'span', 'yrfc-card__source', card.source);
  body.append(footer);

  link.append(media, body);
  return link;
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
