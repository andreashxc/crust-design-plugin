---
generated: false
---

# Ya header nav swap

Swaps the Search and Alice items in the Yandex header navigation while keeping the original DOM nodes in place. Because the experiment moves existing elements instead of rebuilding them, links, selected state, counters, and event handlers remain owned by Yandex.

## Metadata

- Author: `andrew`
- World: `isolated`

## Scope

- `*://ya.ru/search*`
- `*://*.ya.ru/search*`
- `*://ya.ru/alice*`
- `*://*.ya.ru/alice*`
- `*://ya.ru/alice/chat/*`
- `*://*.ya.ru/alice/chat/*`

## Tweaks

| Key | Label | Type | Default |
| --- | --- | --- | --- |
| `order` | Order | select | `"alice_first"` |

Use `alice_first` for the experiment variant and `search_first` as the control order in the popup.
