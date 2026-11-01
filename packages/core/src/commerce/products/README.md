# Products

Products are saved whole: title, rich-text description, photos from the media library,
status, SEO, up to three options ("Size", "Colour") and every variant with its SKU,
barcode, weight, prices per currency (with a "compare at" price) and stock per location.
A variant left out of a save is deleted; one without an `id` is new.

Statuses: `draft` (being prepared), `active` (on sale), `archived` (kept for old orders).
Making a product active needs every variant to have a price in the primary currency.

| Method and path             | Permission        |
| --------------------------- | ----------------- |
| `GET /shop/products`        | `commerce:read`   |
| `POST /shop/products`       | `commerce:update` |
| `GET /shop/products/:id`    | `commerce:read`   |
| `PUT /shop/products/:id`    | `commerce:update` |
| `DELETE /shop/products/:id` | `commerce:update` |

`product-checks.ts` holds the rules beyond the schema; `product-descriptions.ts` the shape
the admin gets. Storefronts read products through `src/commerce/storefront`.
