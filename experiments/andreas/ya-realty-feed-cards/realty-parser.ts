import type { RealtyCard } from './renderer';

const SOURCE_URL = 'https://yandex.ru/realty/moskva_i_moskovskaya_oblast/kupit/kvartira?lr=213';

export const SNAPSHOT_REALTY_CARDS: RealtyCard[] = [
  {
    price: '31 500 000 ₽',
    pricePerMeter: '558 511 ₽ за м²',
    location: 'Шаболовская',
    commute: '15 мин',
    specs: ['2-комн.', '56,4 м²', '1/13 этаж'],
    building: 'Апарт-комплекс «Левел Донской»',
    extra: 'Построен в 2022',
    source: 'Нашлось на Авито, Домклик, Циан',
    tag: '3D-тур',
    href: SOURCE_URL,
  },
  {
    price: '13 550 000 ₽',
    pricePerMeter: '204 992 ₽ за м²',
    location: 'Волоколамская',
    commute: '19 мин',
    specs: ['2-комн.', '66,1 м²', '3/17 этаж'],
    building: 'монолитный дом',
    extra: 'Построен в 2011',
    source: 'Нашлось на Я.Недвижимость, Авито, Циан',
    tag: 'Вторичка',
    href: SOURCE_URL,
  },
  {
    price: '37 000 000 ₽',
    pricePerMeter: '453 988 ₽ за м²',
    location: 'Шелепиха',
    commute: '5 мин',
    specs: ['3-комн.', '81,5 м²', '13/53 этаж'],
    building: 'ЖК Headliner',
    extra: 'Построен в 2024',
    source: 'Нашлось на Я.Недвижимость, РГР, Авито',
    tag: '3D-тур',
    href: SOURCE_URL,
  },
  {
    price: '16 000 000 ₽',
    pricePerMeter: '244 836 ₽ за м²',
    location: 'Реутов',
    commute: '8 мин',
    specs: ['2-комн.', '65,35 м²', '20/25 этаж'],
    building: 'ЖК ЭВО',
    extra: 'Сдача в 1 кв. 2027',
    source: 'Нашлось на Циан',
    tag: 'Новостройка',
    href: SOURCE_URL,
  },
  {
    price: '48 125 000 ₽',
    pricePerMeter: '988 200 ₽ за м²',
    location: 'Площадь Гагарина',
    commute: '9 мин',
    specs: ['2-комн.', '48,7 м²', '4/18 этаж'],
    building: 'Жилой квартал SHIFT',
    extra: 'Премиум-класс',
    source: 'PIONEER',
    tag: 'Промо',
    href: SOURCE_URL,
  },
  {
    price: '14 800 000 ₽',
    pricePerMeter: '231 250 ₽ за м²',
    location: 'Щербинка',
    commute: '11 мин',
    specs: ['3-комн.', '64 м²', '15/17 этаж'],
    building: 'панельный дом',
    extra: 'Построен в 1986',
    source: 'Нашлось на РГР',
    tag: 'Семейная',
    href: SOURCE_URL,
  },
];

export function extractRealtyCardsFromHtml(html: string, baseUrl = SOURCE_URL): RealtyCard[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const cards: RealtyCard[] = [];
  const seen = new Set<string>();

  for (const node of Array.from(doc.querySelectorAll('.SnippetCard.OfferSnippet'))) {
    const card = readOfferSnippet(node, baseUrl);
    if (!card) continue;

    const key = `${card.price}|${card.specs.join('|')}|${card.building}`;
    if (seen.has(key)) continue;

    seen.add(key);
    cards.push(card);
    if (cards.length >= 12) break;
  }

  return cards;
}

function readOfferSnippet(node: Element, baseUrl: string): RealtyCard | null {
  const price = text(node, '.SnippetPrimaryInfo-Title');
  const pricePerMeter = text(node, '.SnippetPrimaryInfo-Subtitle .MetaRealtyFeaturesList-ItemText');
  const location = text(node, '.RealtyMetro-Name');
  const commute = text(node, '.RealtyMetro-Time');
  const source = text(node, '.OfferSnippet-SourcesDescription');
  const tag = text(node, '.OfferSnippet-TopContainer .Label-Content');
  const imageUrl = normalizedImageUrl(
    attr(node, '.MediaCarousel-Image[src]', 'src') ?? attr(node, 'img[src]', 'src'),
    baseUrl,
  );
  const href = normalizedHref(
    attr(node, 'a.SnippetCard-Overlay[href], a[href]', 'href'),
    baseUrl,
  );

  const specsRoot = node.querySelector('.SnippetSecondaryInfo-Specs');
  const specRows = specsRoot
    ? Array.from(specsRoot.querySelectorAll('.MetaRealtyFeaturesList')).map((row) =>
        Array.from(row.querySelectorAll('.MetaRealtyFeaturesList-ItemText'))
          .map(cleanText)
          .filter(Boolean),
      )
    : [];
  const specs = specRows[0] ?? [];
  const [building = '', extra = ''] = specRows[1] ?? [];

  if (!price.includes('₽') || !pricePerMeter.includes('м²') || specs.length < 2) return null;

  return {
    price,
    pricePerMeter,
    location,
    commute,
    specs,
    building,
    extra,
    source,
    tag: tag || listingTag(specs, building, extra),
    href: href ?? baseUrl,
    imageUrl,
  };
}

function listingTag(specs: string[], building: string, extra: string): string {
  const summary = `${specs.join(' ')} ${building} ${extra}`.toLowerCase();
  if (summary.includes('жк') || summary.includes('сдача')) return 'Новостройка';
  if (summary.includes('апарт')) return 'Апартаменты';
  return 'Квартира';
}

function text(root: Element, selector: string): string {
  const node = root.querySelector(selector);
  return node ? cleanText(node) : '';
}

function attr(root: Element, selector: string, name: string): string | null {
  return root.querySelector(selector)?.getAttribute(name) ?? null;
}

function cleanText(node: Element): string {
  return (node.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedHref(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function normalizedImageUrl(value: string | null, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.pathname.includes('_files/')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
