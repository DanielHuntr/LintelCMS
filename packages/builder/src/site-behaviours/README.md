# The elements script

What published pages run for the elements that need more than HTML and CSS: tabs, sliders,
the gallery's lightbox, frames that load on request, before-and-after, counting numbers,
countdowns, big menus, back to top, forms sent in the background and the shop's basket.

It is bundled by `scripts/bundle-site-behaviours.mjs` into `dist/site-behaviours.js`
(`@lintel/builder/site-behaviours.js`), which the built-in website serves at
`/_lintel/elements-<fingerprint>.js` and loads, deferred, only on pages whose design uses one
of these elements (`render/elements/behaviour-types.ts`).

| File                       | What it does                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| `site-behaviours-entry.ts` | Sets every behaviour up once the page is read                         |
| `behaviour-helpers.ts`     | Finding elements by `data-behaviour`, reduced motion                  |
| `layout-behaviours.ts`     | Tabs, one-open accordions, pop-ups in older browsers                  |
| `media-behaviours.ts`      | Sliders, product pictures, lightbox, consent frames, comparisons      |
| `info-behaviours.ts`       | Counters, countdowns, big menus, back to top, sort and language menus |
| `clock-behaviours.ts`      | Live clocks: the time in a chosen place, changed on the minute        |
| `drag-scroll.ts`           | Sliders dragged freely, with momentum and a soft stop at each end     |
| `form-behaviours.ts`       | Forms sent in the background, with problems shown by each field       |
| `shop-api.ts`              | The storefront API through `/_lintel/api/shop`, the cart token        |
| `shop-behaviours.ts`       | Options picker, Add to basket, basket count, order confirmation       |
| `cart-views.ts`            | The basket drawn into the drawer and the basket page, and checkout    |

Every behaviour enhances HTML that already works as far as it can, follows
`prefers-reduced-motion`, and keeps focus where people expect it.
