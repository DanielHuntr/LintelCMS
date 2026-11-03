# Content transfer (exports and imports)

A Lintel export is a site's content in a portable form: content types, collections,
entries, taxonomies and terms, globals, menus and media. Unlike a backup, it leaves out
people, sign-ins, API tokens, webhooks and settings, and importing it adds to a site
rather than replacing it. Used by Build → Import, `lintel export` and `lintel import`.

## The format

`lintel-export.json` (shape in `transfer-format.ts`), alone or in a `.zip` with the media
files under `media/`. Ids are kept, so importing the same export twice finds what the first
import made.

## Importing

1. `import-source.ts` opens the file (a .zip or a plain .json).
2. `content-import-plan.ts` works out what each thing will do: create, update or skip.
   Things are matched by id, then by what people see as their identity: content types,
   taxonomies, globals and menus by handle, terms by slug, media by contents, entries by
   collection, language and slug. The strategy (`skip` or `overwrite`) decides what
   happens to matches.
3. `content-import.service.ts` carries out that same plan in one transaction, so the
   preview never promises something the import does differently, and an import goes in
   whole or not at all. References inside entries (parents, images, terms) are rewritten
   to this site's ids.

In the admin the upload waits in `.lintel/imports` between preview and import
(`content-transfer.service.ts`); uploads nobody imported are removed after a day.

| File                             | What it does                                |
| -------------------------------- | ------------------------------------------- |
| `content-transfer.routes.ts`     | HTTP: export, upload, preview, import       |
| `content-transfer.service.ts`    | The admin's upload → preview → import steps |
| `content-export.service.ts`      | Writing an export                           |
| `content-import-plan.ts`         | Matching and planning                       |
| `content-import.service.ts`      | Previewing and running an import            |
| `content-transfer.repository.ts` | Whole-table reads, row-by-row writes        |
| `transfer-format.ts`             | The export's shape and conflict strategies  |
| `import-source.ts`               | Opening an export file                      |

Everything needs `content:transfer`. Tests in `content-transfer.test.ts` move a small site
to an empty one, import twice, and overwrite.
