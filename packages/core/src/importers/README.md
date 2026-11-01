# Importers: moving a site to Lintel

Settings → Import → "Move your site to Lintel" and `lintel import <source> <file|url>`.
WordPress has its own folder (`src/wordpress-import`) and Shopify lives in the shop
(`src/commerce/shopify-import`); this folder holds the importers for **Webflow, Framer,
Statamic and Umbraco**, built the same way as the WordPress one, and what they share with it.

## How an import goes

1. **Upload** (`POST /site-imports/:source`): the source's reader (`sources/`) reads the
   files into one shape, a `SourceSite` (`source-site.ts`): content types and their fields,
   entries, taxonomies, pictures, menus, global values, and notes on what can't be moved.
   `site-import-items.ts` lists one item per thing to bring in, in an order where
   everything comes after what it needs (pages after their parents, menus last). A zip is
   kept in the imports folder until the import finishes, for its pictures.
2. **Mapping** (`PUT .../mapping`): for each kind of content, the collection here it goes
   into (or a new content type, made with a field for each of the old site's), and which
   field each old field goes into; taxonomies, pictures, drafts, menus, globals, redirects.
   `site-import-mapping.ts` makes the starting choice and checks people's.
3. **Dry run** (`POST .../dry-run`): the whole import in a transaction that is rolled back,
   with pictures checked but not downloaded. Its report is what the import will do.
4. **Run** (`POST .../start`): in the background; each item in its own transaction, marked
   done. A server stop leaves it "paused" (`pauseInterruptedSiteImports`, run on start) and
   starting again resumes from the next item.
5. **Report**: counts, content types made, designed pages to check, renamed slugs, values
   left out and why, suggested redirects, notes and problems.

## Safety

- **Never overwrites.** Content types, taxonomies, terms, menus with items and entries
  already here are used or left as they are; a taken slug gets a number (reported). Entries
  an earlier import of the same site brought in are skipped.
- **Redirects** are suggested from every published entry's old address to its new one,
  worked out the way the site shows it (site start, page tree; see `src/content-roots`).
- **Zips** are read in place, never unpacked under their own names; names that climb out
  (`../`), absolute or Windows paths are ignored; size and file-count limits apply
  (`import-archives.ts`, `src/archives`).
- **Pictures** come from the zip, or are downloaded only from the old site, its CDN and
  hosts added on the mapping screen, never from the server's own network, re-checked after
  each redirect (`site-import-media.ts`, using the WordPress importer's downloader).
- XML is read without expanding entities; YAML without custom tags and with few aliases.

## Files

| File                                                | What it does                                            |
| --------------------------------------------------- | ------------------------------------------------------- |
| `site-import.routes.ts`                             | HTTP (`content:transfer`)                               |
| `site-import.service.ts`                            | Upload, mapping, dry run, start, resume, delete         |
| `site-import-runner.ts`                             | Running the items, in batches                           |
| `site-import-steps.ts`                              | Taxonomies, terms, content types, media, menus, globals |
| `site-import-entries.ts`                            | Entries: values, parents, slugs, redirects              |
| `imported-fields.ts`, `imported-values.ts`          | Fields to make, and values to store                     |
| `imported-menus.ts`                                 | Saving a menu (WordPress uses it too)                   |
| `designed-pages.ts`                                 | Exported HTML pages → designed pages of code blocks     |
| `import-from-files.ts`                              | `lintel import <source> <file                           | url>` |
| `site-import.repository.ts`, `site-import.table.ts` | The `site_imports` and `site_import_items` tables       |
| `sources/`                                          | One reader per system (see its README)                  |
| `fixtures/`                                         | Small, made-up exports for the tests                    |
