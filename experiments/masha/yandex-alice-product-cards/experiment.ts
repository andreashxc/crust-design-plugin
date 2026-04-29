import type { ApplyFn } from '@platform/experiment-sdk';

const NS = 'axr-inline-products';
const STYLE_ID = `${NS}-styles`;
const APPLY_DEBOUNCE_MS = 300;

type ProductCardData = {
  id: string;
  title: string;
  signature: string;
  node: Element;
  query?: string;
};

type StructuredProduct = {
  slot: string;
  title: string;
  query: string;
  signature: string;
};

type VerticalCard = {
  link: string;
  image: string;
  title: string;
  price: string;
  oldPrice: string;
  shop: string;
};

type SearchDiagnostics = {
  method: 'direct-fetch' | 'helpers.fetchPage';
  ok: boolean;
  requestUrl: string;
  responseUrl?: string;
  status?: number;
  reason?: string;
  error?: string;
  htmlLength?: number;
  title?: string;
  verification: boolean;
  selectorCounts?: Record<string, number>;
  textSample?: string;
};

type VerticalResult =
  | {
      ok: true;
      query: string;
      requestUrl: string;
      responseUrl: string;
      htmlLength: number;
      diagnostics?: SearchDiagnostics;
      card: VerticalCard;
    }
  | {
      ok: false;
      query: string;
      requestUrl?: string;
      responseUrl?: string;
      status?: number;
      reason: string;
      error?: string;
      htmlLength?: number;
      selectorsTried?: string[];
      fields?: Partial<VerticalCard>;
      diagnostics?: SearchDiagnostics;
    };

type HiddenNode = {
  node: Element;
};

type ExperimentState = {
  active: boolean;
  applying: boolean;
  inserted: Element[];
  hidden: HiddenNode[];
  observer: MutationObserver | null;
  debugPanel: HTMLElement | null;
  debugPre: HTMLPreElement | null;
  debugSummary: HTMLElement | null;
  applyTimer: number | undefined;
  searchCache: Map<string, Promise<VerticalResult>>;
  lastUrl: string;
  stopped: boolean;
  lastDebugText: string;
};

type DebugProduct = {
  index: number;
  productTitle: string;
  query: string;
  signature: string;
  anchorFound?: boolean;
  anchorText?: string;
  vertical: VerticalResult;
  verticalInserted?: boolean;
  wrapperInserted?: boolean;
};

type DistributeDebug = {
  url: string;
  timestamp: string;
  steps: Record<string, string | number>;
  products: DebugProduct[];
};

const STOP_TOKENS = new Set([
  'смартфон',
  'телефон',
  'phone',
  'mobile',
  'gb',
  'гб',
  'tb',
  'тб',
  'esim',
  'sim',
  'dual',
  'nano',
  'protection',
  'version',
  'global',
  'серый',
  'серебряный',
  'титан',
  'черный',
  'чёрный',
  'белый',
  'синий',
  'голубой',
  'зеленый',
  'зелёный',
  'розовый',
  'фиолетовый',
  'оранжевый',
  'orange',
  'cosmic',
  'titanium',
  'gray',
  'grey',
  'silver',
  'black',
  'white',
  'blue',
  'green',
  'pink',
  'purple',
  'ultramarine',
]);

const styles = `
  .${NS}-wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin: 12px 0 20px;
    align-items: start;
  }

  .${NS}-card {
    width: 100% !important;
    max-width: 100%;
  }

  .${NS}-vertical {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    color: #1f2328;
    text-decoration: none;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 18px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .${NS}-vertical:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
  }

  .${NS}-vertical-media {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: 14px;
    background: linear-gradient(180deg, #fff7f1 0%, #fff 100%);
  }

  .${NS}-vertical-media img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .${NS}-vertical-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 5px 9px;
    font: 700 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #8a3d00;
    border-radius: 999px;
    background: rgba(255, 214, 173, 0.92);
  }

  .${NS}-vertical-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
  }

  .${NS}-vertical-price {
    font: 800 20px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #111827;
  }

  .${NS}-vertical-price-old {
    font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #8a8f98;
    text-decoration: line-through;
  }

  .${NS}-vertical-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    font: 600 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #111827;
  }

  .${NS}-vertical-shop {
    margin-top: auto;
    font: 500 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #6b7280;
  }

  .${NS}-hidden {
    display: none !important;
  }

  .${NS}-debug {
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: 2147483647;
    width: min(520px, calc(100vw - 24px));
    max-height: min(560px, calc(100vh - 24px));
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    background: rgba(18, 18, 20, 0.96);
    color: #f4f4f5;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.42);
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .${NS}-debug-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    font: 600 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .${NS}-debug-actions {
    display: flex;
    gap: 6px;
  }

  .${NS}-debug button {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 4px 8px;
    color: #f4f4f5;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    font: 600 11px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .${NS}-debug-summary {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    color: #d4d4d8;
    white-space: pre-wrap;
  }

  .${NS}-debug pre {
    max-height: 420px;
    margin: 0;
    padding: 10px;
    overflow: auto;
    color: #e4e4e7;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export const apply: ApplyFn = ({ helpers, log }) => {
  const state: ExperimentState = {
    active: false,
    applying: false,
    inserted: [],
    hidden: [],
    observer: null,
    debugPanel: null,
    debugPre: null,
    debugSummary: null,
    applyTimer: undefined,
    searchCache: new Map(),
    lastUrl: location.href,
    stopped: false,
    lastDebugText: '',
  };

  helpers.injectStyle(styles, { id: STYLE_ID });

  const renderDebugPanel = (payload: unknown) => {
    ensureDebugPanel();
    const text = JSON.stringify(payload, null, 2);
    state.lastDebugText = text;
    if (state.debugPre) state.debugPre.textContent = text;
    if (state.debugSummary) state.debugSummary.textContent = summarizeDebugPayload(payload);
  };

  const ensureDebugPanel = () => {
    if (state.debugPanel || !document.body) return;

    const panel = document.createElement('aside');
    panel.className = `${NS}-debug`;
    panel.setAttribute('role', 'status');

    const header = document.createElement('div');
    header.className = `${NS}-debug-header`;

    const title = document.createElement('span');
    title.textContent = 'Alice cards debug';
    header.append(title);

    const actions = document.createElement('div');
    actions.className = `${NS}-debug-actions`;

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(state.lastDebugText || '');
    });
    actions.append(copy);

    const hide = document.createElement('button');
    hide.type = 'button';
    hide.textContent = 'Hide';
    hide.addEventListener('click', () => {
      panel.style.display = 'none';
    });
    actions.append(hide);

    header.append(actions);
    panel.append(header);

    const summary = document.createElement('div');
    summary.className = `${NS}-debug-summary`;
    summary.textContent = 'Waiting for experiment run...';
    panel.append(summary);

    const pre = document.createElement('pre');
    pre.textContent = '{}';
    panel.append(pre);

    state.debugPanel = panel;
    state.debugSummary = summary;
    state.debugPre = pre;
    helpers.injectNode(panel);
  };

  const fetchSearchHtml = async (
    query: string,
  ): Promise<
    | {
        ok: true;
        requestUrl: string;
        responseUrl: string;
        html: string;
        diagnostics: SearchDiagnostics;
      }
    | {
        ok: false;
        reason: string;
        requestUrl: string;
        responseUrl?: string;
        status?: number;
        error?: string;
        diagnostics: SearchDiagnostics;
      }
  > => {
    const url = new URL('/search/', location.origin);
    url.searchParams.set('text', query);
    url.searchParams.set('products_mode', '1');
    url.searchParams.set('from', 'tabbar');
    const requestUrl = url.toString();
    let directFetchError = '';

    try {
      const response = await fetch(requestUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: 'http-error',
          requestUrl,
          responseUrl: response.url || requestUrl,
          status: response.status,
          diagnostics: {
            method: 'direct-fetch',
            ok: false,
            requestUrl,
            responseUrl: response.url || requestUrl,
            status: response.status,
            reason: 'http-error',
            verification: false,
          },
        };
      }

      const html = await response.text();
      const diagnostics = analyzeSearchHtml({
        html,
        method: 'direct-fetch',
        requestUrl,
        responseUrl: response.url || requestUrl,
        status: response.status,
      });
      if (isYandexVerificationPage(html)) {
        return {
          ok: false,
          reason: 'yandex-verification',
          requestUrl,
          responseUrl: response.url || requestUrl,
          diagnostics: {
            ...diagnostics,
            ok: false,
            reason: 'yandex-verification',
          },
        };
      }

      return {
        ok: true,
        requestUrl,
        responseUrl: response.url || requestUrl,
        html,
        diagnostics,
      };
    } catch (error) {
      directFetchError = error instanceof Error ? error.message : String(error);
      const fallback = await helpers.fetchPage(requestUrl).catch((fallbackError: unknown) => ({
        ok: false as const,
        url: requestUrl,
        reason: 'network_error' as const,
        message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      }));

      if (!fallback.ok) {
        return {
          ok: false,
          reason: fallback.reason,
          requestUrl,
          responseUrl: fallback.url,
          error: fallback.message,
          diagnostics: {
            method: 'helpers.fetchPage',
            ok: false,
            requestUrl,
            responseUrl: fallback.url,
            reason: fallback.reason,
            error: directFetchError
              ? `direct fetch failed: ${directFetchError}; helper failed: ${fallback.message}`
              : fallback.message,
            verification: false,
          },
        };
      }

      const diagnostics = analyzeSearchHtml({
        html: fallback.html,
        method: 'helpers.fetchPage',
        requestUrl,
        responseUrl: fallback.url,
      });
      if (isYandexVerificationPage(fallback.html)) {
        return {
          ok: false,
          reason: 'yandex-verification',
          requestUrl,
          responseUrl: fallback.url,
          diagnostics: {
            ...diagnostics,
            ok: false,
            reason: 'yandex-verification',
          },
        };
      }

      return {
        ok: true,
        requestUrl,
        responseUrl: fallback.url,
        html: fallback.html,
        diagnostics,
      };
    }
  };

  const fetchVerticalCard = async (product: ProductCardData): Promise<VerticalResult> => {
    const query = buildSearchQuery(product);
    if (!query) return { ok: false, query, reason: 'empty-query' };

    const cached = state.searchCache.get(query);
    if (cached) return cached;

    const request = (async (): Promise<VerticalResult> => {
      try {
        const response = await fetchSearchHtml(query);
        if (!response.ok) {
          return {
            ok: false,
            query,
            requestUrl: response.requestUrl || '',
            responseUrl: response.responseUrl || '',
            status: response.status,
            reason: response.reason,
            error: response.error || '',
            diagnostics: response.diagnostics,
          };
        }

        const parsed = parseVerticalCardFromHtml(
          response.html,
          response.responseUrl || response.requestUrl,
          query,
        );
        return {
          query,
          requestUrl: response.requestUrl,
          responseUrl: response.responseUrl || response.requestUrl,
          htmlLength: response.html.length,
          diagnostics: response.diagnostics,
          ...parsed,
        };
      } catch (error) {
        console.warn(`${NS}: failed to fetch vertical card`, error);
        return {
          ok: false,
          query,
          requestUrl: '',
          reason: 'fetch-threw',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })();

    state.searchCache.set(query, request);
    return request;
  };

  const removeInserted = () => {
    for (const node of state.inserted) node.remove();
    state.inserted = [];
  };

  const hideNode = (node: Element | null | undefined) => {
    if (!node) return;

    state.hidden.push({ node });
    node.classList.add(`${NS}-hidden`);
  };

  const unhideAll = () => {
    for (const item of state.hidden) item.node.classList.remove(`${NS}-hidden`);
    state.hidden = [];
  };

  const tryHideGalleryIntro = (gallery: Element | null) => {
    const previous = gallery?.previousElementSibling;
    if (!previous?.classList.contains('FuturisMarkdown')) return;

    const text = normalizeText(previous.textContent || '');
    if (/(где купить|примеры моделей|упомянутых выше)/.test(text)) {
      hideNode(previous);
    }
  };

  const distributeCards = async () => {
    const debug: DistributeDebug = {
      url: location.href,
      timestamp: new Date().toISOString(),
      steps: {},
      products: [],
    };

    const message = getLatestAssistantMessage();
    if (!message) {
      debug.steps.message = 'missing';
      log('debug', debug);
      renderDebugPanel(debug);
      return { ok: false, reason: 'Не нашёл последний ответ Алисы.' };
    }
    debug.steps.message = 'ok';

    const gallery = getGallery(message);
    if (!gallery) {
      debug.steps.gallery = 'missing';
      log('debug', debug);
      renderDebugPanel(debug);
      return { ok: false, reason: 'Не нашёл блок с товарными карточками.' };
    }
    debug.steps.gallery = 'ok';

    const rawCards = Array.from(gallery.querySelectorAll('.ProductGalleryCard'));
    if (!rawCards.length) {
      debug.steps.galleryCards = 0;
      log('debug', debug);
      renderDebugPanel(debug);
      return { ok: false, reason: 'В галерее нет карточек.' };
    }
    debug.steps.galleryCards = rawCards.length;

    const structuredProducts = parseStructuredProducts();
    const cards = rawCards.map(buildCardData);
    const products = mapStructuredProductsToCards(structuredProducts, cards);
    const anchors = collectAnchors(message, gallery);
    const verticalCards = await Promise.all(
      products.map(async (product) => {
        try {
          return await fetchVerticalCard(product);
        } catch (error) {
          return {
            ok: false,
            query: product.query || product.title || '',
            reason: 'fetch-wrapper-threw',
            error: error instanceof Error ? error.message : String(error),
          } satisfies VerticalResult;
        }
      }),
    );

    debug.steps.structuredProducts = structuredProducts.length;
    debug.steps.mappedProducts = products.length;
    debug.steps.anchors = anchors.length;

    if (!anchors.length) {
      debug.products = products.map((product, index) => ({
        index: index + 1,
        productTitle: product.title,
        query: product.query || '',
        signature: product.signature,
        vertical: verticalCards[index],
      }));
      log('debug', debug);
      renderDebugPanel(debug);
      return { ok: false, reason: 'Не нашёл текстовые блоки для вставки карточек.' };
    }

    const lastInsertedByAnchor = new Map<Element, Element>();
    let attachedCount = 0;

    products.forEach((product, index) => {
      const anchor = findBestAnchor(product, anchors);
      const verticalResult = verticalCards[index];
      const productDebug: DebugProduct = {
        index: index + 1,
        productTitle: product.title,
        query: product.query || '',
        signature: product.signature,
        anchorFound: Boolean(anchor),
        anchorText: anchor?.textContent?.trim()?.slice(0, 220) || '',
        vertical: verticalResult,
      };

      if (!anchor) {
        debug.products.push(productDebug);
        return;
      }

      const clone = product.node.cloneNode(true) as Element;
      clone.classList.add(`${NS}-card`);

      const wrapper = document.createElement('div');
      wrapper.className = `${NS}-wrapper`;
      wrapper.append(clone);

      if (verticalResult.ok) {
        wrapper.append(createVerticalCardNode(verticalResult.card));
        productDebug.verticalInserted = true;
      } else {
        productDebug.verticalInserted = false;
      }

      const insertionPoint = lastInsertedByAnchor.get(anchor) || anchor;
      insertionPoint.insertAdjacentElement('afterend', wrapper);
      lastInsertedByAnchor.set(anchor, wrapper);
      state.inserted.push(wrapper);
      attachedCount += 1;
      productDebug.wrapperInserted = true;
      debug.products.push(productDebug);
    });

    if (!attachedCount) {
      removeInserted();
      debug.steps.attachedCount = attachedCount;
      log('debug', debug);
      renderDebugPanel(debug);
      return { ok: false, reason: 'Не удалось сопоставить карточки с упоминаниями товаров.' };
    }

    hideNode(gallery);
    tryHideGalleryIntro(gallery);

    debug.steps.attachedCount = attachedCount;
    debug.steps.verticalInsertedCount = debug.products.filter(
      (item) => item.verticalInserted,
    ).length;
    log('debug', debug);
    renderDebugPanel(debug);

    return { ok: true, count: attachedCount };
  };

  const activate = async () => {
    const result = await distributeCards();
    if (!result.ok) return result;

    state.active = true;
    log('applied', { count: result.count });
    return result;
  };

  const deactivate = () => {
    removeInserted();
    unhideAll();
    state.active = false;
    return { ok: true };
  };

  const applyWhenReady = async () => {
    if (state.stopped || state.active || state.applying) return;

    state.applying = true;
    try {
      const result = await activate();
      if (!result.ok) {
        log('not applied yet', { reason: result.reason });
      }
    } catch (error) {
      console.warn(`${NS}: apply failed`, error);
      log('debug', {
        url: location.href,
        timestamp: new Date().toISOString(),
        steps: {
          crash: 'applyWhenReady',
        },
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      state.applying = false;
    }
  };

  const scheduleApply = () => {
    if (state.stopped || state.active || state.applying) return;
    if (state.applyTimer !== undefined) {
      window.clearTimeout(state.applyTimer);
    }
    state.applyTimer = window.setTimeout(() => {
      state.applyTimer = undefined;
      void applyWhenReady();
    }, APPLY_DEBOUNCE_MS);
  };

  const handleNavigationChanges = () => {
    if (location.href === state.lastUrl) return;

    state.lastUrl = location.href;
    deactivate();
    state.searchCache.clear();
    scheduleApply();
  };

  const boot = () => {
    state.lastUrl = location.href;
    ensureDebugPanel();
    scheduleApply();

    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        handleNavigationChanges();
        scheduleApply();
      });

      const host = document.body || document.documentElement;
      state.observer.observe(host, {
        childList: true,
        subtree: true,
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  return () => {
    state.stopped = true;
    state.observer?.disconnect();
    if (state.applyTimer !== undefined) {
      window.clearTimeout(state.applyTimer);
      state.applyTimer = undefined;
    }
    deactivate();
  };
};

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value: string): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function extractTokens(value: string): string[] {
  return compactText(value)
    .split(' ')
    .filter(Boolean)
    .filter((token) => {
      if (STOP_TOKENS.has(token)) return false;
      if (/^\d+(gb|гб|tb|тб)$/.test(token)) return false;
      if (/^\d{1,4}$/.test(token)) return true;
      return token.length > 1;
    });
}

function cleanProductName(value: string): string {
  return extractTokens(value).join(' ');
}

function buildSearchQuery(product: Pick<ProductCardData, 'query' | 'title'>): string {
  const preferred = product.query || product.title || '';
  const compact = preferred
    .replace(/[.,;:()[\]"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = extractTokens(compact);
  return tokens.length ? tokens.slice(0, 8).join(' ') : compact;
}

function isYandexVerificationPage(html: string): boolean {
  return /<title>\s*Верификация\s*<\/title>/i.test(html) || /checkcaptchafast/i.test(html);
}

function analyzeSearchHtml(args: {
  html: string;
  method: SearchDiagnostics['method'];
  requestUrl: string;
  responseUrl: string;
  status?: number;
}): SearchDiagnostics {
  const doc = new DOMParser().parseFromString(args.html, 'text/html');
  const selectorCounts = {
    AdvProductGalleryCard: doc.querySelectorAll('.AdvProductGalleryCard').length,
    ProductGalleryCard: doc.querySelectorAll('.ProductGalleryCard').length,
    EProductSnippet2: doc.querySelectorAll('.EProductSnippet2').length,
    EProductSnippet2Title: doc.querySelectorAll('.EProductSnippet2-Title').length,
    EProductSnippet2Overlay: doc.querySelectorAll('.EProductSnippet2-Overlay[href]').length,
    EProductSnippet2Thumb: doc.querySelectorAll('.EProductSnippet2-Thumb[href]').length,
    EPriceContent: doc.querySelectorAll('.EPrice-Content').length,
    priceDrivenCandidates: findPriceDrivenRoots(doc, '').length,
    img: doc.querySelectorAll('img').length,
  };
  const textSample = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 420);

  return {
    method: args.method,
    ok: true,
    requestUrl: args.requestUrl,
    responseUrl: args.responseUrl,
    status: args.status,
    htmlLength: args.html.length,
    title: doc.title || undefined,
    verification: isYandexVerificationPage(args.html),
    selectorCounts,
    textSample,
  };
}

function summarizeDebugPayload(payload: unknown): string {
  const debug = payload as Partial<DistributeDebug> | undefined;
  const products = Array.isArray(debug?.products) ? debug.products : [];
  const verticalOk = products.filter((product) => product.vertical?.ok).length;
  const verticalReasons = products.reduce<Record<string, number>>((acc, product) => {
    const reason = product.vertical?.ok ? 'ok' : product.vertical?.reason || 'unknown';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  const selectorTotals = products.reduce<Record<string, number>>((acc, product) => {
    const counts = product.vertical?.diagnostics?.selectorCounts || {};
    for (const [key, value] of Object.entries(counts)) {
      acc[key] = (acc[key] || 0) + value;
    }
    return acc;
  }, {});
  const methods = products.reduce<Record<string, number>>((acc, product) => {
    const method = product.vertical?.diagnostics?.method || 'none';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  return [
    `time: ${debug?.timestamp || 'n/a'}`,
    `steps: ${JSON.stringify(debug?.steps || {})}`,
    `products: ${products.length}; vertical ok: ${verticalOk}`,
    `vertical reasons: ${JSON.stringify(verticalReasons)}`,
    `fetch methods: ${JSON.stringify(methods)}`,
    `search selector totals: ${JSON.stringify(selectorTotals)}`,
  ].join('\n');
}

function absoluteUrl(value: string | null | undefined, baseUrl: string): string {
  if (!value) return '';

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function parseVerticalCardFromHtml(
  html: string,
  baseUrl: string,
  query: string,
): { ok: true; card: VerticalCard } | Omit<VerticalResult, 'query'> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root =
    doc.querySelector('.AdvProductGalleryCard') ||
    doc.querySelector('.ProductGalleryCard') ||
    doc.querySelector('.EProductSnippet2');

  if (root) {
    const card = extractVerticalCardFromRoot(root, baseUrl, query);
    if (card) return { ok: true, card };
  }

  const priceDrivenRoot = findBestPriceDrivenRoot(doc, query);
  if (priceDrivenRoot) {
    const card = extractVerticalCardFromRoot(priceDrivenRoot, baseUrl, query);
    if (card) return { ok: true, card };
  }

  if (!root && !priceDrivenRoot) {
    return {
      ok: false,
      reason: 'card-root-not-found',
      selectorsTried: [
        '.AdvProductGalleryCard',
        '.ProductGalleryCard',
        '.EProductSnippet2',
        'price-driven root from .EPrice-Content',
      ],
    };
  }

  return {
    ok: false,
    reason: 'missing-required-fields',
    fields: {
      link: '',
      image: '',
      title: '',
      price: '',
      oldPrice: '',
      shop: '',
    },
  };
}

function extractVerticalCardFromRoot(
  root: Element,
  baseUrl: string,
  query: string,
): VerticalCard | null {
  const linkNode =
    root.querySelector('.EProductSnippet2-Overlay[href]') ||
    root.querySelector('.EProductSnippet2-Thumb[href]') ||
    bestLinkNode(root, query);
  const titleNode = root.querySelector('.EProductSnippet2-Title, [class*="Title"]');
  const priceNode =
    root.querySelector('.EPriceGroup-Price .EPrice-Content') ||
    root.querySelector('.EPrice-Content');
  const oldPriceNode = root.querySelector('.EPriceGroup-PriceOld .EPrice-Content');
  const shopNode = root.querySelector('.EProductSnippet2-ShopInfoTitle .Line-AddonContent');
  const imageNode = bestImageNode(root);

  const link = absoluteUrl(linkNode?.getAttribute('href'), baseUrl);
  const image = absoluteUrl(imageUrl(imageNode), baseUrl);
  const title =
    titleNode?.textContent?.replace(/\s+/g, ' ').trim() ||
    bestTitleFromRoot(root, query, priceNode?.textContent || '');
  const price =
    priceNode?.getAttribute('title')?.replace(/\s+/g, ' ').trim() ||
    priceNode?.textContent?.replace(/\s+/g, ' ').trim() ||
    '';
  const oldPrice =
    oldPriceNode?.getAttribute('title')?.replace(/\s+/g, ' ').trim() ||
    oldPriceNode?.textContent?.replace(/\s+/g, ' ').trim() ||
    '';
  const shop = shopNode?.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (!link || !title) {
    return null;
  }

  return {
    link,
    image,
    title,
    price,
    oldPrice,
    shop,
  };
}

function findBestPriceDrivenRoot(doc: Document, query: string): Element | null {
  const candidates = findPriceDrivenRoots(doc, query);
  return candidates[0]?.root || null;
}

function findPriceDrivenRoots(
  doc: Document,
  query: string,
): Array<{ root: Element; score: number }> {
  const seen = new Set<Element>();
  const candidates: Array<{ root: Element; score: number }> = [];

  for (const priceNode of Array.from(doc.querySelectorAll('.EPrice-Content'))) {
    let current = priceNode.parentElement;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parentElement) {
      if (seen.has(current)) continue;

      const text = current.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (text.length < 20 || text.length > 1800) continue;

      const hasLink = Boolean(current.querySelector('a[href]'));
      const hasImage = Boolean(current.querySelector('img'));
      const hasPrice = Boolean(current.querySelector('.EPrice-Content'));
      if (!hasLink || !hasPrice) continue;

      const overlapScore = query ? scoreQueryOverlap(query, text) : 0;
      const score = overlapScore + (hasImage ? 8 : 0) - depth;
      if (score <= 0 && query) continue;

      seen.add(current);
      candidates.push({ root: current, score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scoreQueryOverlap(query: string, text: string): number {
  const queryTokens = extractTokens(query);
  const textTokens = new Set(extractTokens(text));
  return queryTokens.reduce((score, token) => score + (textTokens.has(token) ? 6 : 0), 0);
}

function bestLinkNode(root: Element, query: string): HTMLAnchorElement | null {
  const links = Array.from(root.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  return (
    links
      .map((link) => ({
        link,
        score:
          scoreQueryOverlap(query, link.textContent || '') + (link.querySelector('img') ? 4 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.link ||
    links.find((link) => link.querySelector('img')) ||
    links[0] ||
    null
  );
}

function bestImageNode(root: Element): HTMLImageElement | null {
  const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  return (
    images.find((image) => image.currentSrc || image.src || image.getAttribute('src')) ||
    images[0] ||
    null
  );
}

function imageUrl(image: HTMLImageElement | null): string {
  if (!image) return '';
  const srcset = image.getAttribute('srcset') || image.getAttribute('data-srcset') || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  return (
    image.currentSrc ||
    image.getAttribute('src') ||
    image.getAttribute('data-src') ||
    srcsetFirst ||
    ''
  );
}

function bestTitleFromRoot(root: Element, query: string, priceText: string): string {
  const lines = (root.textContent || '')
    .split(/\n| {2,}/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      if (line.length < 6 || line.length > 180) return false;
      if (priceText && line.includes(priceText.trim())) return false;
      if (/^(реклама|перейти|купить|подробнее)$/i.test(line)) return false;
      if (/^\d[\d\s.,]*\s*(₽|руб)/i.test(line)) return false;
      return true;
    });

  return (
    lines
      .map((line) => ({ line, score: scoreQueryOverlap(query, line) }))
      .sort((a, b) => b.score - a.score || b.line.length - a.line.length)[0]?.line || ''
  );
}

function createVerticalCardNode(card: VerticalCard): HTMLAnchorElement {
  const root = document.createElement('a');
  root.className = `${NS}-vertical`;
  root.href = card.link;
  root.target = '_blank';
  root.rel = 'noopener noreferrer';

  const media = document.createElement('div');
  media.className = `${NS}-vertical-media`;

  const badge = document.createElement('div');
  badge.className = `${NS}-vertical-badge`;
  badge.textContent = 'Из выдачи';
  media.append(badge);

  if (card.image) {
    const image = document.createElement('img');
    image.src = card.image;
    image.alt = card.title;
    image.loading = 'lazy';
    media.append(image);
  }

  const body = document.createElement('div');
  body.className = `${NS}-vertical-body`;

  if (card.price) {
    const price = document.createElement('div');
    price.className = `${NS}-vertical-price`;
    price.textContent = card.price;
    body.append(price);
  }

  if (card.oldPrice) {
    const oldPrice = document.createElement('div');
    oldPrice.className = `${NS}-vertical-price-old`;
    oldPrice.textContent = card.oldPrice;
    body.append(oldPrice);
  }

  const title = document.createElement('div');
  title.className = `${NS}-vertical-title`;
  title.textContent = card.title;
  body.append(title);

  if (card.shop) {
    const shop = document.createElement('div');
    shop.className = `${NS}-vertical-shop`;
    shop.textContent = card.shop;
    body.append(shop);
  }

  root.append(media);
  root.append(body);

  return root;
}

function parseStructuredProducts(): StructuredProduct[] {
  const raw = document.getElementById('axr-result-text')?.textContent?.trim();
  if (!raw) return [];

  const parser = new DOMParser();
  const xml = parser.parseFromString(raw, 'application/xml');
  if (xml.querySelector('parsererror')) return [];

  return Array.from(xml.querySelectorAll('products > product[slot]'))
    .map((node): StructuredProduct | null => {
      const slot = node.getAttribute('slot') || '';
      const title = node.querySelector('title')?.textContent?.trim() || '';
      const query = node.querySelector('query')?.textContent?.trim() || title;

      if (!slot || !title) return null;

      return {
        slot,
        title,
        query,
        signature: cleanProductName(title || query),
      };
    })
    .filter((product): product is StructuredProduct => Boolean(product));
}

function getLatestAssistantMessage(): Element | null {
  const messages = Array.from(document.querySelectorAll('.AliceChat-Message .Message')).filter(
    (message) => !message.classList.contains('Message_from_user'),
  );

  return messages.at(-1) || null;
}

function getGallery(message: Element | null): Element | null {
  if (!message) return null;

  const galleries = Array.from(
    message.querySelectorAll('.FuturisAdvProductGallery, .FuturisRSRProductGallery'),
  );

  return galleries.at(-1) || null;
}

function buildCardData(card: Element, index: number): ProductCardData {
  const titleNode = card.querySelector('.EProductSnippet2-Title');
  const overlay = card.querySelector('.EProductSnippet2-Overlay');
  const title =
    titleNode?.textContent?.trim() ||
    overlay?.getAttribute('aria-label')?.split('.')[0]?.trim() ||
    `product-${index + 1}`;

  return {
    id: `${NS}-product-${index + 1}`,
    title,
    signature: cleanProductName(title),
    node: card,
  };
}

function scoreMatch(product: Pick<ProductCardData, 'signature' | 'title'>, candidateText: string) {
  const productSignature = product.signature || cleanProductName(product.title);
  const candidateSignature = cleanProductName(candidateText);
  const productTokens = extractTokens(productSignature);
  const candidateTokens = new Set(extractTokens(candidateSignature));

  if (!productTokens.length || !candidateTokens.size) return 0;

  let overlap = 0;
  for (const token of productTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }

  const normalizedProduct = normalizeText(productSignature);
  const normalizedCandidate = normalizeText(candidateSignature);
  const includesPhrase =
    normalizedCandidate.includes(normalizedProduct) ||
    normalizedProduct.includes(normalizedCandidate);

  return overlap * 10 + (includesPhrase ? 25 : 0);
}

function collectAnchors(message: Element, gallery: Element | null): Element[] {
  const candidates = Array.from(
    message.querySelectorAll(
      '.FuturisMarkdown h1, .FuturisMarkdown h2, .FuturisMarkdown h3, .FuturisMarkdown h4, .FuturisMarkdown p, .FuturisMarkdown li',
    ),
  );

  return candidates.filter((node) => {
    if (!node.textContent?.trim()) return false;
    if (node.closest(`.${NS}-wrapper`)) return false;
    if (gallery && !(node.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      return false;
    }

    return true;
  });
}

function findBestAnchor(product: ProductCardData, anchors: Element[]): Element | null {
  let best: Element | null = null;
  let bestScore = 0;

  for (const anchor of anchors) {
    const score = scoreMatch(product, anchor.textContent || '');
    if (score > bestScore) {
      bestScore = score;
      best = anchor;
    }
  }

  if (!best) return null;

  const minScore = extractTokens(product.signature).length > 2 ? 20 : 10;
  return bestScore >= minScore ? best : null;
}

function mapStructuredProductsToCards(
  products: StructuredProduct[],
  cards: ProductCardData[],
): ProductCardData[] {
  if (!products.length) return cards;

  const remainingCards = [...cards];
  const mapped: ProductCardData[] = [];

  for (const product of products) {
    let bestIndex = -1;
    let bestScore = 0;

    remainingCards.forEach((card, index) => {
      const score = scoreMatch(product, card.title);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) continue;

    const [card] = remainingCards.splice(bestIndex, 1);
    mapped.push({
      ...card,
      title: product.title,
      query: product.query,
      signature: product.signature || card.signature,
    });
  }

  return mapped.length ? mapped.concat(remainingCards) : cards;
}
