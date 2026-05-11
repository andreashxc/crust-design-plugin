# Ya Realty Feed Cards Analysis

## Task

Add compact apartment cards from Yandex Realty into the main `ya.ru` feed alongside product and video entities.

## Target URL

https://ya.ru/

## Business Goal

Apartment cards in the feed should increase transitions from `ya.ru` to Yandex Realty by making the real estate vertical visible in a familiar, low-friction feed format.

## Current Evidence

- `ya.ru` is a compact, utility-first entry page with search and a personalized content/feed surface.
- The feed already supports commercial and media entities, so a realty module should feel like another scannable feed recommendation instead of a separate landing block.
- The attached `real.zip` contains a saved Yandex Realty listing page. The object cards are rendered as `.SnippetCard.OfferSnippet` inside `.RealtyListing-SnippetsList`.
- Each apartment object card carries `.MediaCarousel-Image`, `.SnippetPrimaryInfo-Title`, `.SnippetPrimaryInfo-Subtitle`, `.RealtyMetro-Name`, `.RealtyMetro-Time`, `.SnippetSecondaryInfo-Specs`, `.OfferSnippet-SourcesDescription`, and optional `.OfferSnippet-TopContainer .Label-Content`.
- The experiment uses a runtime fetch from `https://yandex.ru/realty/moskva_i_moskovskaya_oblast/kupit/kvartira?lr=213` when available and a snapshot fallback captured from the saved page on 2026-05-11.

## Diagnosis

Real estate is a high-consideration vertical, so it needs enough detail to justify a click, but the `ya.ru` feed is not the place for full listing cards. The highest-leverage format is a compact object card that preserves the Yandex Realty decision cues: photo, total price, price per meter, transit/location, room count, area, floor, building/JК, and source marketplaces.

The main risk is visual weight. Full realty cards would dominate the feed and feel like an ad block. The module should borrow the feed card rhythm, keep secondary data small, and make the click target obvious.

## Solution Branches

- Conservative: inserts one horizontal apartment card after the first feed item. Lowest layout risk, useful as a control for incremental click lift.
- Balanced: inserts a three-card strip with one concise heading and CTA. Best impact/risk ratio because it makes the vertical visible while preserving feed density.
- Exploratory: inserts a stronger four-card module with one featured card and three supporting cards. Higher salience, useful if the team wants to test whether realty can become a larger feed entity.

## Recommended Direction

Recommend `balanced`.

It gives users a real choice set without making the feed feel like a real estate page. Three cards are enough to communicate variety across budget/location/new-build options, while the compact module still fits the existing feed pattern.

## Implementation Notes

- `variant`, `card_count`, `placement`, and `show_annotations` are tweakable from Crust.
- The experiment applies only on `ya.ru` home, even though the manifest includes `yandex.ru/realty*` so the helper can fetch source listing data.
- Parsing uses `DOMParser` and real Realty selectors rather than a text-line heuristic.
- Rendering avoids `innerHTML`; all listing text is inserted through DOM text nodes.
- If live fetching fails or the page structure changes, snapshot object cards still render.

## Risks

- `ya.ru` feed DOM is dynamic and personalized, so insertion uses heuristic feed/search detection with a body fallback.
- Live realty parsing depends on `.OfferSnippet` class names staying stable; snapshot data protects the prototype but should be refreshed for production experiments.
- Saved HTML images point to local `*_files/` paths and are intentionally ignored by the runtime parser. Live fetched image URLs are used only when they are valid `http:` or `https:` URLs.

## QA Checklist

- [ ] Experiment appears in the Crust popup on `https://ya.ru/`.
- [ ] `balanced` shows three compact object cards from Realty listings.
- [ ] `conservative` shows one smaller card.
- [ ] `exploratory` shows a larger module with a featured card.
- [ ] `card_count` adjusts visible cards up to six.
- [ ] `placement` moves the module without duplicate inserts.
- [ ] Annotation mode explains the branch logic.
- [ ] Cleanup removes injected DOM and styles.
- [ ] Mobile width keeps text inside cards and CTA readable.
