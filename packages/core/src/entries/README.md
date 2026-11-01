# Entries

An entry is one piece of content: a page, a blog post. Its values are checked against its
collection's blueprint (see `src/fieldtypes`) every time it is saved, and every save,
publish, unpublish and restore is kept as a revision.

## Endpoints

| Method and path                                   | Permission        | Body                            | Success                                 |
| ------------------------------------------------- | ----------------- | ------------------------------- | --------------------------------------- |
| `GET /collections/:handle/entries`                | `entries:read`    | query below                     | 200 `{ entries, total, page, perPage }` |
| `POST /collections/:handle/entries`               | `entries:create`  | `{ data, slug?, parentId? }`    | 201 `Entry`                             |
| `POST /collections/:handle/entries/reorder`       | `entries:update`  | `{ order: [{ id, parentId }] }` | 204                                     |
| `GET /entries/:id`                                | `entries:read`    | none                            | 200 `Entry`                             |
| `PATCH /entries/:id`                              | `entries:update`  | `{ data?, slug?, parentId? }`   | 200 `Entry`                             |
| `POST /entries/:id/publish`                       | `entries:publish` | none                            | 200 `Entry`                             |
| `POST /entries/:id/unpublish`                     | `entries:publish` | none                            | 200 `Entry`                             |
| `POST /entries/:id/schedule`                      | `entries:publish` | `{ publishAt }` (in the future) | 200 `Entry`                             |
| `DELETE /entries/:id`                             | `entries:delete`  | none                            | 204                                     |
| `GET /entries/:id/revisions`                      | `entries:read`    | none                            | 200 `{ revisions }`, newest first       |
| `GET /entries/:id/revisions/:revisionId`          | `entries:read`    | none                            | 200, with its `data`                    |
| `POST /entries/:id/revisions/:revisionId/restore` | `entries:update`  | none                            | 200 `Entry`                             |

The list takes `status` (`draft`, `published`, `scheduled`), `search` (in titles, any
case), `page`, `perPage` (up to 100, default 25) and `parentId` (direct children only).
Shapes are in `entries.schema.ts`; an `Entry` is a summary plus `collectionHandle`, `data`,
`blueprint` and `hasUnpublishedChanges`.

## Saving

- Unknown keys are dropped; empty optional fields are stored as null; problems come back
  as 400 `INVALID_REQUEST` with a message per field in `fields`.
- `PATCH` merges `data` over the saved values, so sending one field changes only that one.
- Without a slug, one is made from the title ("Café & bar" becomes `cafe-and-bar`) and
  numbered until it is free in the collection and site (`hello-2`). A typed slug is tidied
  the same way and must be free (`fields.slug` says so if not). Changing the title later
  keeps the slug, so addresses don't break.
- The author is recorded as `updatedBy` and on the revision.

## Publishing

`data` is the working copy. Publishing copies it to `publishedData`, which is all the
delivery API serves, so a change saved to a live page stays off the site until the next
publish. `hasUnpublishedChanges` is true while the two differ. See
`docs/decisions/0006-published-copy-of-entries.md`.

| Action    | Status afterwards | `publishedData` | `publishedAt`           |
| --------- | ----------------- | --------------- | ----------------------- |
| publish   | `published`       | copy of `data`  | now                     |
| unpublish | `draft`           | null            | null                    |
| schedule  | `scheduled`       | unchanged       | unchanged until it runs |

A scheduled entry is published by `publishDueEntries`, which the scheduler runs on
startup and every minute (see `src/scheduler`). Its publish date is the time it was due.
Its revision has no author, since nobody pressed anything. If an earlier version was live,
it stays live until then. Slug and parent changes take effect straight away.

## Order

`dated` collections list newest first (by publish date, else due date, else creation).
`flat` and `tree` collections use `sortOrder`, set by `reorder` and by new entries going
last among their siblings. Trees list depth first: each page, then its children.
`reorder` counts each entry's place among the listed entries with the same parent, so
send the whole tree (or all the children of one parent); entries left out keep their
place. It refuses entries from elsewhere, parents in a flat collection, and loops.
Deleting a page moves its children up to its parent.

## For the media library

`findEntriesUsingAsset(database, assetId)` in `entries.service.ts` lists the entries
whose saved or published values use an asset, as `[{ entryId, title }]`, for
`409 ASSET_IN_USE`.

## Files

| File                                       | What it does                                         |
| ------------------------------------------ | ---------------------------------------------------- |
| `entries.table.ts`                         | The `entries` and `revisions` tables                 |
| `entries.schema.ts`                        | Zod schemas for requests and responses               |
| `entries.service.ts`                       | Creating, saving, deleting; checking values; slugs   |
| `entry-listing.service.ts`                 | Lists in each structure's order, a page at a time    |
| `entry-ordering.service.ts`                | Parents and `reorder`                                |
| `entry-publishing.service.ts`              | Publish, unpublish, schedule and `publishDueEntries` |
| `revisions.service.ts`                     | Listing, viewing and restoring revisions             |
| `entry-responses.ts`                       | Stored rows to API shapes; `hasUnpublishedChanges`   |
| `slugs.ts`, `entry-tree.ts`                | Pure helpers: making slugs, putting a tree in order  |
| `entries.repository.ts`                    | Database reads and writes for entries                |
| `entry-publishing.repository.ts`           | Finding and claiming due scheduled entries           |
| `revisions.repository.ts`                  | Database reads and writes for revisions              |
| `entries.errors.ts`                        | Named errors with the messages people see            |
| `entries.routes.ts`, `revisions.routes.ts` | The endpoints                                        |
