# Site design (builder side)

The site's design variables and shared styles while a page is designed. The builder gets
them, and a way to save a change, from its `siteDesign` prop; the admin loads and saves
them through `GET` and `PUT /website/design` (core's `site-design/`). What they are and how
a page is drawn with them is in `@lintel/builder-model`'s `site-design/` folder.

| File                      | What it does                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `site-design-context.tsx` | The context, the site's variables as tokens, and small design edits |
| `SharedStyleBar.tsx`      | The top of Style: use, make, rename or detach a shared style        |
| `SharedStylePreview.tsx`  | A small "Aa" tile drawn with a shared style's colours and border    |
| `SiteStylesPanel.tsx`     | Site styles: the site's colours, sizes, fonts and shared styles     |

- **Site styles** is in the right panel: "Site styles" in Style opens it over the element's
  Style, with Back, and it's what Style shows with nothing selected. Rows open one at a time
  to rename, change or delete; empty groups offer a few starting points ("Ink", "Gutter").
  Deleting a variable first writes its value out on this page's elements (a step in Undo),
  so they look as they did; deleting a shared style detaches this page's elements.
- **Shared styles:** with one, the Style panel changes the shared style ("Every Card")
  until "Only this one" is chosen; then changes stay on the element, over the shared look.
  Making, using and detaching are steps in Undo; changes to the shared style itself are
  saved for the site straight away and are not in the page's Undo.
- **Variables:** colour swatches, font choices, size chips and size boxes offer the site's
  own before the theme's. A colour or size picked by hand can be saved as one.
- **Variants:** "Make a variant" on the shared-style row makes one ("Button · Outline")
  that follows its base; the row switches between them. "Select them" in Site styles
  selects and outlines this page's elements that use a shared style.
