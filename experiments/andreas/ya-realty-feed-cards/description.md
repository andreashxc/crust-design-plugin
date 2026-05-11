---
generated: false
---

# Ya Realty Feed Cards

Adds compact apartment object cards from Yandex Realty into the `ya.ru` feed.

## Scope

- Applies visually on `https://ya.ru/`.
- Manifest also includes `https://yandex.ru/realty*` so the experiment can request live source data through Crust helpers.
- The parser targets real listing markup from the attached saved page: `.SnippetCard.OfferSnippet`.

## Variants

- `conservative`: one compact Realty object card after the first detected feed item.
- `balanced`: recommended, three object cards in a feed-native strip.
- `exploratory`: larger module with a featured object card and stronger CTA.

## Tweaks

- `variant`: `conservative`, `balanced`, or `exploratory`.
- `show_annotations`: show branch rationale on the page.
- `card_count`: 1-6 visible apartment cards.
- `placement`: `auto`, `top`, or `after_first_card`.

## Recommendation

Use `balanced` for the first product readout. It exposes actual apartment listings as a meaningful feed entity while keeping the module compact enough to sit next to product and video cards.

## How To Test In Crust

1. Run `corepack pnpm dev` or `corepack pnpm build`.
2. Reload the Crust extension because this experiment adds `yandex.ru/realty*` host scope.
3. Open `https://ya.ru/`.
4. Enable `Ya Realty Feed Cards` in the Crust popup.
5. Try the three presets in `presets/`.
