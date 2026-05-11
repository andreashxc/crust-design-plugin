---
generated: false
---

# Ya Realty Feed Cards

Adds separate apartment object cards from Yandex Realty into the `ya.ru` feed.

## Scope

- Applies visually on `https://ya.ru/`.
- Manifest also includes `https://yandex.ru/realty*` so the experiment can request live source data through Crust helpers.
- The parser targets real listing markup from the attached saved page: `.SnippetCard.OfferSnippet`.

## Variants

- `conservative`: one compact Realty object card after the first detected feed item.
- `balanced`: recommended, three separate object cards inserted as normal feed siblings.
- `exploratory`: more visually dominant object cards with taller media.

## Tweaks

- `variant`: `conservative`, `balanced`, or `exploratory`.
- `show_annotations`: show branch rationale on the page.
- `card_count`: 1-6 separate apartment cards inserted into the feed.
- `placement`: `auto`, `top`, or `after_first_card`.

## Recommendation

Use `balanced` for the first product readout. It exposes actual apartment listings as feed-native cards next to product and video cards.

## How To Test In Crust

1. Run `corepack pnpm dev` or `corepack pnpm build`.
2. Reload the Crust extension because this experiment adds `yandex.ru/realty*` host scope.
3. Open `https://ya.ru/`.
4. Enable `Ya Realty Feed Cards` in the Crust popup.
5. Try the three presets in `presets/`.
