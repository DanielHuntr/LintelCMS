# Delivery

The API websites and apps read published content from.

**It is public by design.** It needs no session and no key, because it only ever serves
what an editor has published, which is meant to be seen. Every query filters on the
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

Browsers on other sites can't call it directly yet: CORS only allows the admin's origin.
Server-side rendering (the usual way sites use it) isn't affected.

## Files

| File                     | What it does                                        |
| ------------------------ | --------------------------------------------------- |
| `delivery.routes.ts`     | The endpoints and the caching header                |
| `delivery.service.ts`    | Published entries, with images looked up in one go  |
| `delivered-values.ts`    | Expanding image and rich text values                |
| `entry-urls.ts`          | Filling in route patterns                           |
| `delivery.repository.ts` | Database reads, always limited to published content |
| `delivery.schema.ts`     | Zod schemas for requests and responses              |
| `delivery.errors.ts`     | The 404 for an entry that isn't published           |
