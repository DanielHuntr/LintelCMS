# site-design

The site's design system, made in the page builder: design variables (named colours, sizes
and fonts such as "Sand" or "Wide gutter") and shared styles (a look saved under a name,
such as "Card", used by many elements). Both start empty.

- `site-design.routes.ts`: `GET` and `PUT /website/design`. Changing it needs
  `builder:blocks`, since, like a block, it changes every page.
- `site-design.service.ts`: reading (an empty design when nothing readable is saved) and
  saving, checked by `siteDesignSchema`. Each save has a `revision` (when it was saved); a
  PUT that sends the revision it read is refused with 409 `SITE_DESIGN_CHANGED` when someone
  saved since, so a builder left open on an older copy can't undo another person's change.
  The builder then shows the latest styles and says so. A PUT without one always saves.
- `site-design.repository.ts`: the one `siteDesign` row in the settings table.

What variables and shared styles are, and how a page is drawn with them, lives in
`@lintel/builder-model`'s `site-design/` folder. The website gets the variables as custom
properties at the end of its stylesheet, and the shared styles with each page's data (see
`website/site-context.service.ts` and `website/page-data.service.ts`). Saving clears the
rendered pages, like any write. The reasoning is in docs/decisions/0035-editorial-layouts.md.
