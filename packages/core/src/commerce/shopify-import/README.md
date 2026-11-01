# Moving from Shopify

Brings a shop over from the CSV files Shopify's admin exports: no Shopify login, app or API
key is needed. Only the products file is required; customers and orders are optional.

| File      | Shopify admin                 | Becomes                                            |
| --------- | ----------------------------- | -------------------------------------------------- |
| Products  | Products → Export (plain CSV) | Products, options, variants, prices, stock, photos |
| Customers | Customers → Export            | Customers with their address (never passwords)     |
| Orders    | Orders → Export               | Archived orders: records to look up, not to refund |

Collections come from the products file's "Collection" column (as manual collections) and
from any tags the shop owner picks (as automatic collections, "tag is summer").

## The steps

1. `POST /shop/imports/shopify` reads the files into a plan and answers with a preview:
   counts, the first products, which column goes where, columns with nowhere to go, and
   warnings (gift cards, photos off Shopify's servers).
2. `PUT /shop/imports/:id/options`: the mapping screen's choices.
3. `POST /shop/imports/:id/dry-run`: every check, nothing saved or downloaded.
4. `POST /shop/imports/:id/run`, again and again: each call works for a few seconds and
   saves where it got to after every item, so progress shows, and a closed tab or a restart
   loses nothing; the next call carries on. A lease stops two windows working at once.
5. The final report: what came in, what was skipped and why, and redirects from each
   product's Shopify address (`/products/<handle>`) to its new one. With the SEO plugin on,
   they're also added to Settings → Redirects as suggestions to accept.

Every step can be repeated: products (by handle), collections (by handle), customers (by
email) and orders (by name) already in the shop are skipped.

## Photos

Only addresses on Shopify's image servers (`cdn.shopify.com`, `cdn.shopifycdn.net`) are
downloaded, over HTTPS, following redirects only to those hosts, up to 20 MB each, and then
checked like any upload to the media library. Anything else is skipped and listed in the
report, and the product is imported without it.

| File                                                               | What it does                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| `csv.ts`                                                           | Reading CSV as spreadsheets write it                  |
| `shopify-products.ts`, `shopify-customers.ts`, `shopify-orders.ts` | Reading each export                                   |
| `shopify-mapping.ts`                                               | Shopify's shapes into Lintel's, checked               |
| `shopify-images.ts`                                                | Downloading photos safely                             |
| `shopify-import-steps.ts`                                          | Bringing in one product, collection, customer, order  |
| `shopify-import.service.ts`                                        | Starting, dry runs, batches and redirects             |
| `shopify-import-preview.ts`                                        | The preview, mapping and progress the admin shows     |
| `archived-orders.service.ts`                                       | Listing archived orders (`GET /shop/archived-orders`) |
| `fixtures/`                                                        | Hand-made exports for the tests                       |
