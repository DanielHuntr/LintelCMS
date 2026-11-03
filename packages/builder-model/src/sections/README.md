# Sections

The builders the section library and the starter sites are made from. `section-parts.ts`
has the small pieces (containers, headings, buttons, cards, grids, illustrations and
`animate(presetId)`), styled only with the theme's tokens; the other files put them together
into sections that take their words as arguments:

| File               | Sections                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heroes.ts`        | Centred, split and banner heroes, and the top of an inner page                                                                                     |
| `features.ts`      | Feature cards, numbered steps, a story beside a picture, gallery                                                                                   |
| `social-proof.ts`  | One quote, three quotes, prices, facts and figures                                                                                                 |
| `closers.ts`       | Questions, calls to action, contact details and footers                                                                                            |
| `visits.ts`        | Opening times, and booking in three steps                                                                                                          |
| `shop.ts`          | Products from the shop in a grid (needs the commerce plugin)                                                                                       |
| `pack-intros.ts`   | The packs' intros (editorial, big number, video, big type, wide picture) and invitations                                                           |
| `pack-features.ts` | Alternating rows, a feature list, a comparison, numbered points, team, founder's note, picture wall, drag gallery                                  |
| `pack-closers.ts`  | Names row, quote wall and portrait quote, numbers, single plan and plan table, two kinds of questions, contact with a map or a form, three footers |

The library itself, with default words and categories, is `src/templates/`:
`section-templates.ts` has the groups (by purpose, never by kind of business) and the shape,
`opening-sections.ts` and `closing-sections.ts` the sections, each with search keywords, and
`section-packs.ts` the packs: more layouts for every group, added after the first ones.
