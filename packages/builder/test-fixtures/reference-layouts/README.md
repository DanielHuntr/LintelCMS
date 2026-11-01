# Reference layouts

Three pages rebuilt with nothing but what the builder offers, to show (and test) that
advanced styling and free layouts can make complex, poster-like designs. They are test
fixtures only: not templates, not shipped. The pictures in `media/` are simple placeholder
drawings, and the words are made up.

| File                   | What it shows                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fashion-editorial.ts` | Giant words around a photo card, a cut-out figure behind them, a turned script sticker, thin italic letters inside bold words                                        |
| `eyewear-minimal.ts`   | Giant words cropped off the page's edges with the product between them, vertical side text, tiny specification text                                                  |
| `agency-bold.ts`       | Condensed type, a photo seen through a diagonal cut in a letter, gradient-filled words, a team breaking out of a card, tilted photo cards, a person in front of type |

`render-reference.ts` draws a layout the way the website does (checked as a save would,
drawn by `renderPage`, inside the website's own page document and stylesheet).
`src/browser-tests/reference-layouts.test.ts` checks they stay valid, fit 1440, 768 and
390 pixel screens without sideways scrolling, and read in Layers order.

To compare them with the pictures they were rebuilt from:

```bash
pnpm --filter @lintel/builder exec tsx test-fixtures/reference-layouts/screenshot-references.ts \
  /tmp/reference-shots /path/to/reference/pictures
```

## Not reproduced

- Real photography, and people cut out of photos: the builder places pictures that are
  already cut out (a PNG or SVG with a transparent background); it doesn't remove
  backgrounds.
- A testimonial that slides: the arrows are links. A slider is an element, not a style.
- Small raised numbers next to menu links (the bag count) and differently styled brackets
  inside links: menus and links don't have styled words, only headings and paragraphs do.
- The exact typefaces: the layouts use the bundled open-licence fonts closest in spirit.
