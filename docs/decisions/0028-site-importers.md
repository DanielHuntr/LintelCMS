# 28. Moving a site to Lintel: one engine for the site importers

Date: 2026-11-03

## Decision

Build → Import → "Move your site to Lintel" offers an importer for WordPress, Webflow,
Framer, Statamic and Umbraco (and Shopify while the shop is on), each with a
`lintel import <source> <file|url>` equivalent.

- WordPress keeps its own importer (`src/wordpress-import`), which now also brings menus,
  custom fields and WooCommerce products. Shopify stays in the shop.
- Webflow, Framer, Statamic and Umbraco share one engine (`src/importers`). Each system has
  a reader that only turns its export into one shape, a `SourceSite`; the engine does the
  rest: mapping, dry run, running, resuming and the report. Their imports are stored in
  `site_imports` and `site_import_items` (migration `0023_add_site_importers`).
- Every importer goes the same way: upload, what we found and can't move, mapping with
  sensible defaults, a dry run, progress in the background, then a plain-English report.
- Pages designed in Webflow or Framer come in as code blocks on a designed page, with
  every text and picture marked as editable so people can change them without code.

## Why

- **One engine, small readers.** The hard parts (never overwriting, slugs, page trees,
  redirects, pictures, resuming) are the same for every system. Writing them once means a
  fix reaches every importer, and adding another system is a reader and some fixtures.
- **Resumable by design.** Each item is brought in, and marked done, in its own
  transaction, so a server restart leaves the import paused and starting it again carries
  on from the next item. The dry run is the same work in a transaction that is rolled
  back, so what it promises is what happens.
- **Safe with untrusted files.** Zips are read in place with size and file-count limits
  and paths that climb out ignored; XML is read without expanding entities; pictures are
  downloaded only from the old site and hosts people allow, never from the server's own
  network.
- **Nothing is overwritten.** Content already here is used or left alone; a taken slug
  gets a number, and the report says so.

## Consequences

- A new source needs a reader in `src/importers/sources` and hand-made fixtures; it must
  say in plain words what it can't move.
- Webflow and Framer pages are a best effort and the screens say so. Interactions,
  animations and scripts don't come across.
- Imports are not tied to users, so restoring a backup leaves them be.
