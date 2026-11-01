# Collections

A collection is a group of entries that share a blueprint: Pages, Blog posts, Case studies.
Its `structure` decides how its entries are arranged:

- `tree`: pages with child pages, in an order set by hand;
- `dated`: newest first, like a blog;
- `flat`: a simple list, in an order set by hand.

Its `routePattern` says where its entries live on the site, for the delivery API's `url`.
It must start with `/` and contain `{slug}`; it may also use `{year}`, `{month}` and
`{day}` (from the publish date). Left out, it is `/<handle>/{slug}`; null means the
entries have no page of their own.

Its `previewUrlPattern` is where its website shows drafts for live preview, such as
`https://example.com/api/preview?path={url}&token={token}`. It is null until a site is
connected, and the admin then uses its built-in preview. See `src/preview`.

## Endpoints

| Method and path               | Permission           | Body                                                                              | Success                             |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| `GET /collections`            | `collections:read`   | none                                                                              | 200 `{ collections: [Collection] }` |
| `GET /collections/:handle`    | `collections:read`   | none                                                                              | 200 `Collection`                    |
| `POST /collections`           | `collections:update` | `{ handle, name, blueprintHandle, structure, routePattern?, previewUrlPattern? }` | 201 `Collection`                    |
| `PUT /collections/:handle`    | `collections:update` | any of `{ name, blueprintHandle, structure, routePattern, previewUrlPattern }`    | 200 `Collection`                    |
| `DELETE /collections/:handle` | `collections:update` | none                                                                              | 204                                 |

`Collection = { id, handle, name, blueprintHandle, structure, routePattern, previewUrlPattern, entryCount, updatedAt }`

`PUT` changes only what is sent. Changing a `tree` to another structure keeps the entries
in their order but removes their parents. A collection can only be deleted once it has no
entries (409 `COLLECTION_NOT_EMPTY`), so content is never lost by accident. Creating a
handle that is in use is 409 `COLLECTION_HANDLE_TAKEN`; an unknown handle is 404.

## Default content

`default-collections.ts` holds what every site starts with:

- **Pages** (`pages`, tree, `/{slug}`), blueprint `page`: title, summary, hero image, body,
  and "Page sections", a blocks field with Hero, Text, Image, Call to action and FAQ blocks.
  Sites set up before the page builder keep their page blueprint as it was; the field can be
  added under Content types.
  Made by `POST /setup/site` (see `src/setup`).
- **Blog posts** (`posts`, dated, `/blog/{slug}`), blueprint `post`: title, excerpt,
  featured image, body, category (News, Guides, Updates). Made when the `blog` plugin is
  switched on, at setup or later with `PUT /plugins` (see `src/plugins`).

Both use `ensureCollection`, which only creates what is missing and never changes a
collection or blueprint that is already there. Switching a plugin off deletes nothing.

## Files

| File                        | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `collections.table.ts`      | The `collections` table                                  |
| `collections.schema.ts`     | Zod schemas, structures and route pattern rules          |
| `collections.service.ts`    | CRUD and `ensureCollection`                              |
| `default-collections.ts`    | Pages and Blog posts, and the functions that ensure them |
| `collections.repository.ts` | Database reads and writes, with entry counts             |
| `collections.errors.ts`     | Named errors with the messages people see                |
| `collections.routes.ts`     | The endpoints                                            |
