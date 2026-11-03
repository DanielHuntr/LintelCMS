# Site design (builder side)

The site's design variables and shared styles while a page is designed. The builder gets
them, and a way to save a change, from its `siteDesign` prop; the admin loads and saves
them through `GET` and `PUT /website/design` (core's `site-design/`). What they are and how
a page is drawn with them is in `@lintel/builder-model`'s `site-design/` folder.

| File                      | What it does                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| `site-design-context.tsx` | The context, the site's variables as tokens, and small design edits  |
| `SharedStyleBar.tsx`      | The top of Style: use, make, rename or detach a shared style         |
| `SiteStylesPanel.tsx`     | Style with nothing selected: the site's colours, sizes, fonts, looks |

- **Shared styles:** with one, the Style panel changes the shared style ("Every Card")
  until "Only this one" is chosen; then changes stay on the element, over the shared look.
  Making, using and detaching are steps in Undo; changes to the shared style itself are
  saved for the site straight away and are not in the page's Undo.
- **Variables:** colour swatches, font choices and spacing chips offer the site's own after
  the theme's. A colour picked by hand can be saved as a site colour from under the swatches.
