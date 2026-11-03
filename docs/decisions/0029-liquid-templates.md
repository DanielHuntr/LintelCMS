# 29. Page templates can be Liquid files in the project

Date: 2026-11-03

Numbered 0029 because 0027 and 0028 are taken by work on other branches.

## Decision

Developers who would rather write HTML than use the visual designer can keep page templates
as Liquid files in their project, drawn by LiquidJS (MIT) on the built-in website. The
folder is `site/` at the project root, or `LINTEL_TEMPLATES`: `templates/<collection>.liquid`
for a collection's entries, `layouts/` for `{% layout %}` and `partials/` for `{% render %}`.
Without the folder, or a template for a collection, nothing changes.

- **The `<head>` stays Lintel's.** A template that draws a fragment is put inside the shared
  document (head, skip link, header, footer); a layout that draws a whole document gets the
  head where `{% lintel_head %}` is. SEO tags, the stylesheet and the styles of designs and
  forms drawn on the page come from the same code as every other page, so SEO and preview
  can't drift.
- **Lintel's parts are tags that reuse what the site already draws:** `{% image %}` is the
  built-in `ResponsiveImage`, `{% form %}` is the builder's Form element (drawn through the
  builder's renderer, with its data loaded as for a design), `{% design %}` is the page's
  design, `{% menu %}` reads menus through the same service as the header.
- **Choosing per page** is a reserved key, `_template`, in the entry's values. Field handles
  start with a letter, so it can't clash; it is kept through the blueprint check, so it is
  saved, published, previewed and kept in revisions like a field, with no migration. The
  website reads it from the stored values, because delivery leaves out what isn't a field.
- **Strict by default:** output is HTML-escaped, files are read only from the three folders
  (LiquidJS checks real paths, so links out are refused too), unknown filters and variables
  are errors, only own properties are read, and rendering stops after five seconds.
- **Caching:** finished pages use the rendered-pages cache like any page. Parsed templates
  are kept; in development a file watcher starts a fresh engine and empties the cache when
  anything in the folder changes, so `pnpm dev` needs no restart.

## Why

- Liquid is the template language agencies are most likely to know (Shopify, Jekyll,
  Eleventy), it is designed to run templates that aren't fully trusted, and LiquidJS is
  maintained, typed and has no dependencies.
- TSX templates (`SiteTemplate`) remain for changing the whole site's look in code; Liquid
  is for page-by-page HTML without a build step.
- A reserved key is the smallest change that follows the draft and publish model. A column
  or a table would need its own handling for drafts, publishing, revisions and copies.

## Consequences

- Blog indexes, archives, search, shop pages and the 404 page still use the built-in
  template; Liquid templates are for entries' pages.
- `_template` appears in an entry's values in the admin API, but not in the delivery API.
- Templates are trusted code from the project, but are still run strictly, so a slip in a
  template can't print unescaped content or read files outside the folder.
