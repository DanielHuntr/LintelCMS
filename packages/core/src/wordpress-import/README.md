# WordPress import

Brings a WordPress site into Lintel from its WXR export (Tools → Export in WordPress):
posts, pages with their parents, categories, tags, images, and authors (added as people
with no password, who set their own). Used by Settings → Import → Import from WordPress.

## How an import goes

1. **Upload** (`POST /wordpress-imports`): `wxr-parser.ts` reads the export and
   `wordpress-import-items.ts` lists one item per thing to bring in, in an order where
   everything comes after what it needs (authors and terms first, parents before child
   pages). An optional zip of `wp-content` is kept beside it.
2. **Mapping** (`PUT .../mapping`): which collection and taxonomy each kind goes into,
   where images come from, authors, drafts, redirects. `wordpress-fields.ts` finds the
   field for each part (content, excerpt, featured image, categories, tags).
3. **Dry run** (`POST .../dry-run`): the whole import in a transaction that is rolled back,
   with images checked but not downloaded. Its report is what the import will do.
4. **Run** (`POST .../start`): `wordpress-import-runner.ts` does each item in its own
   transaction and marks it done, so an import stopped part way is "paused" on the next
   start and resumes from where it was.

## Content and images

`wordpress-content.ts` splits block-editor and classic HTML into pieces;
`wordpress-rich-text.ts` turns them into Lintel rich text with the admin's own editor
extensions. What rich text can't hold (embeds, galleries, shortcodes, images inside text)
is kept as an HTML block and listed in the report, so nothing is lost.

`wordpress-media.ts` brings images in from the old site or the zip. Downloads only go to
the old site's own address and the hosts added on the mapping screen, checked again after
every redirect; private and local addresses are refused unless the server allows them for
tests; only image and PDF types up to the media library's size limit are taken.

Posts and pages an earlier import of the same site brought in are skipped, so uploading
the same export again makes no copies. Published entries get a suggested redirect from
their old address (accept them in Settings → SEO tools → Redirects).

| File                          | What it does                            |
| ----------------------------- | --------------------------------------- |
| `wordpress-import.routes.ts`  | HTTP                                    |
| `wordpress-import.service.ts` | Upload, mapping, dry run, start, resume |
| `wordpress-import-runner.ts`  | Running the items, in batches           |
| `wordpress-item-handlers.ts`  | Authors, terms and files                |
| `wordpress-entries.ts`        | Posts and pages                         |
| `wordpress-import-report.ts`  | The report, from the items              |
| `wxr-parser.ts`               | Reading the export                      |
| `fixtures/small-bakery.xml`   | The sample export the tests use         |

Everything needs `content:transfer`.
