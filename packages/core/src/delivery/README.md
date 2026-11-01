# Delivery

The API websites and apps read published content from.

**It is public by design.** By default it needs no session and no key, because it only
ever serves what an editor has published, which is meant to be seen. A site can switch on
"only with a token" (the `deliveryRequiresToken` setting); then every request needs an API
token (`Authorization: Bearer ...`, see `src/api-tokens`) or an admin session, checked by
`requireDeliveryAccess` in `require-delivery-access.ts`. The GraphQL API (`src/graphql`)
and the SEO plugin's public endpoints use the same guard. Every query filters on the
published copy of an entry (`publishedData`, see `src/entries`), so drafts, scheduled
entries that haven't gone live and unpublished changes are never served. An unpublished
entry gets the same 404 as one that doesn't exist, so the API doesn't reveal it.

## Endpoints

| Method and path                   | Query             | Success                                  |
| --------------------------------- | ----------------- | ---------------------------------------- |
| `GET /delivery/:collection`       | `page`, `perPage` | 200 `{ items: [DeliveredEntry], total }` |
| `GET /delivery/:collection/:slug` | none              | 200 `DeliveredEntry`, or 404 `NOT_FOUND` |

`DeliveredEntry = { id, slug, url, publishedAt, data }`

- `url` is the collection's `routePattern` filled in (`/blog/{slug}` becomes `/blog/hello`),
  or null when the collection has none.
- `data` holds every field of the blueprint, empty ones as null. Image fields become
  `{ id, url, alt, width, height, focalPoint }` (null if the image has been deleted), looked
  up once per response through `server.assetLookup`. Rich text becomes `{ json, html }`,
  rendered on the server with `@tiptap/html` and the editor's StarterKit extensions.
- Lists are newest first for dated collections and in the hand-set order otherwise.

Responses carry `Cache-Control: public, max-age=60`, so a CDN or browser may keep them
for a minute; a publish shows up within that time.

Browsers on other sites may call it when their origin is listed in Settings → API access
(the `deliveryAllowedOrigins` setting). Those origins get CORS headers on `/delivery`,
`/graphql` and `/openapi.json` only, without cookies; see `src/http/cross-origin.ts`.
Server-side rendering (the usual way sites use it) doesn't need CORS at all.

## Who may read: settings

| Method and path        | Permission        | Body                                 | Success                                |
| ---------------------- | ----------------- | ------------------------------------ | -------------------------------------- |
| `GET /delivery-access` | `settings:read`   | none                                 | 200 `{ requireToken, allowedOrigins }` |
| `PUT /delivery-access` | `settings:update` | `{ requireToken?, allowedOrigins? }` | 200, the same                          |

Website addresses are tidied to their origin (`https://example.com/blog/` is kept as
`https://example.com`).

## Files

| File                         | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `delivery.routes.ts`         | The endpoints and the caching header                |
| `delivery.service.ts`        | Published entries, with images looked up in one go  |
| `delivered-values.ts`        | Expanding image and rich text values                |
| `entry-urls.ts`              | Filling in route patterns                           |
| `delivery.repository.ts`     | Database reads, always limited to published content |
| `delivery.schema.ts`         | Zod schemas for requests and responses              |
| `delivery.errors.ts`         | The 404 for an entry that isn't published           |
| `delivery-access.*.ts`       | The "who may read" settings and their endpoints     |
| `require-delivery-access.ts` | The guard: open, or a token when the site asks      |
