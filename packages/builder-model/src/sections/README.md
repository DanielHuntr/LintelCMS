# Sections

The builders the section library and the starter sites are made from. `section-parts.ts`
has the small pieces (containers, headings, buttons, cards, grids, illustrations and
`animate(presetId)`), styled only with the theme's tokens; the other files put them together
into sections that take their words as arguments:

| File              | Sections                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `heroes.ts`       | Centred, split and banner heroes, and the top of an inner page   |
| `features.ts`     | Feature cards, numbered steps, a story beside a picture, gallery |
| `social-proof.ts` | One quote, three quotes, prices, facts and figures               |
| `closers.ts`      | Questions, calls to action, contact details and footers          |

The library itself, with default words and categories, is `src/templates/section-templates.ts`.
