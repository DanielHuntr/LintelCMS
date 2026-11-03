# The element library's drawings

How each element of the library (`@lintel/builder-model`'s `*-components.ts`) prints its HTML,
one file per Insert group: `layout.tsx`, `media.tsx`, `info.tsx`, `navigation.tsx`,
`forms.tsx`, `collections.tsx` and `shop.tsx`, plus `effects.tsx` (the ready-made animated
elements) and `creative.tsx` (text on a path, Lottie, Rive and the sticker playground; see
decision 0055). `index.ts` is the one list of them that `standardRenders` spreads in.

- **Semantic HTML, no inline styles.** The element's outer tag gets its builder class; its
  parts use fixed `lintel-<element>__<part>` classes styled in `element-stylesheet.ts`, every
  rule wrapped in `:where()` so the Style panel always wins.
- **Works without script.** Accordions are `<details>`, pop-ups are `<dialog>` opened by
  `command="show-modal"`, forms post normally. Elements that need more carry
  `data-behaviour="..."`, and `behaviour-types.ts` lists their types so only pages with them
  load the elements script (`../../site-behaviours`).
- **Nothing from elsewhere loads unasked.** Videos, maps and embeds draw a placeholder; the
  script swaps in the frame when the visitor presses its button (`media-addresses.ts` makes
  privacy-friendly addresses).
- **Data comes from the page.** Collection lists, product grids, forms and the header read
  `PageData` through `../data-context.tsx`; on the canvas they get samples.
- **Icons** are the Lucide icons in `icon-set.ts`, drawn as inline SVG.

Tests: `elements.test.tsx` draws every element in both modes and checks the important ones.
