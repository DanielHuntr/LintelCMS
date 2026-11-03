# Site design

The site's design system as pages are drawn with it: its design variables (named colours,
sizes and fonts) and its shared styles. Saved once for the whole site by core's
`site-design/`, edited in the builder's `site-design/`.

| File                  | What it does                                                            |
| --------------------- | ----------------------------------------------------------------------- |
| `design-variables.ts` | Variables, their checks, and the `:root` rule that sets them            |
| `shared-styles.ts`    | Making, using, detaching and drawing shared styles                      |
| `variable-uses.ts`    | Where variables are used, and writing a variable's value out            |
| `site-design.ts`      | The whole design, its schema, and edits across it (deleting a variable) |

See `docs/decisions/0035-editorial-layouts.md` and `0038-reusing-styles.md`.

A colour variable can have a dark-mode value; it is written with `light-dark()`, which
follows the `color-scheme` the theme sets (see `designVariablesStylesheet`).
