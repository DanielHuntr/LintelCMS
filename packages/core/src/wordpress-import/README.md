# WordPress import

Brings a WordPress site into Lintel from its WXR export (Tools → Export in WordPress):
posts, pages with their parents, categories, tags, images, authors (added as people with
the Author role and no password, who set their own), menus, custom fields (Advanced Custom
Fields and the like) and WooCommerce products. Used by Settings → Import → WordPress and
`lintel import wordpress <export.xml> [wp-content.zip]`.

## Menus, custom fields and products

- **Menus** (`wordpress-menus.ts`): each menu, with its nesting and order, saved through
  `src/importers/imported-menus.ts`. Links to pages and posts point at the entries they
  became; addresses on the old site become paths here. Category links are left out.
- **Custom fields** (`wordpress-custom-fields.ts`): the mapping screen lists the keys found
  on posts and pages (marking Advanced Custom Fields' own) and suggests the field with the
  same handle; each value is read as the field needs (ACF dates, attachment ids as images,
  PHP-serialized lists). A value the field refuses is left out and reported; the post isn't.
- **WooCommerce** (`woocommerce-reader.ts`, `woocommerce-products.ts`): simple and variable
  products become shop products, the way Shopify's do: options from attributes, a variant
  per variation, SKU, price (sale price, with the regular one as "compare at"), weight and
  stock. Only while the shop is switched on and has a market. Each gets a suggested
  redirect from `/product/<slug>` to `/products/<handle>`.

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

| File                            | What it does                            |
| ------------------------------- | --------------------------------------- |
| `wordpress-import.routes.ts`    | HTTP                                    |
| `wordpress-import.service.ts`   | Upload, mapping, dry run, start, resume |
| `wordpress-import-runner.ts`    | Running the items, in batches           |
| `wordpress-item-handlers.ts`    | Authors, terms and files                |
| `wordpress-entries.ts`          | Posts and pages                         |
| `wordpress-import-report.ts`    | The report, from the items              |
| `wxr-parser.ts`, `wxr-nodes.ts` | Reading the export                      |
| `wordpress-menus.ts`            | Menus                                   |
| `wordpress-custom-fields.ts`    | Custom fields into mapped fields        |
| `woocommerce-reader.ts`         | Reading WooCommerce products            |
| `woocommerce-products.ts`       | Products into the shop                  |
| `fixtures/`                     | Made-up exports the tests use           |

Everything needs `content:transfer`.
