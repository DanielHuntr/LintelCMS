# Entries

An entry is one piece of content: a page, a blog post. Its values are checked against its
collection's blueprint (see `src/fieldtypes`) every time it is saved, and every save,
publish, unpublish and restore is kept as a revision.

## Endpoints

| Method and path                                   | Permission        | Body                            | Success                                               |
| ------------------------------------------------- | ----------------- | ------------------------------- | ----------------------------------------------------- |
| `GET /collections/:handle/entries`                | `entries:read`    | query below                     | 200 `{ entries, total, page, perPage }`               |
| `POST /collections/:handle/entries`               | `entries:create`  | `{ data, slug?, parentId? }`    | 201 `Entry`                                           |
| `GET /entries/:id`                                | `entries:read`    | none                            | 200 `Entry`                                           |
| `PATCH /entries/:id`                              | `entries:update`  | `{ data?, slug?, parentId? }`   | 200 `Entry`                                           |
| `POST /entries/:id/publish`                       | `entries:publish` | none                            | 200 `Entry`, or 400 `NOT_READY_TO_PUBLISH`            |
| `POST /entries/:id/unpublish`                     | `entries:publish` | none                            | 200 `Entry`                                           |
| `POST /entries/:id/schedule`                      | `entries:publish` | `{ publishAt }` (in the future) | 200 `Entry`                                           |
| `GET /entries/:id/live`                           | `entries:read`    | none                            | 200 `{ publishedAt, data }` (null if never published) |
| `DELETE /entries/:id`                             | `entries:delete`  | none                            | 204                                                   |
| `POST /entries/:id/duplicate`                     | `entries:create`  | none                            | 201 `Entry`, a draft copy                             |
| `GET /entries/:id/revisions`                      | `entries:read`    | none                            | 200 `{ revisions }`, newest first                     |
| `GET /entries/:id/revisions/:revisionId`          | `entries:read`    | none                            | 200, with its `data`                                  |
| `POST /entries/:id/revisions/:revisionId/restore` | `entries:update`  | none                            | 200 `Entry`                                           |
| `POST /entries/:id/translations`                  | `entries:create`  | `{ locale }`                    | 201 `Entry`, or 409 `TRANSLATION_EXISTS`              |

The list takes `status` (`draft`, `published`, `scheduled`), `search` (in titles, any
case), `page`, `perPage` (up to 100, default 25), `parentId` (direct children only) and
`locale` (the site's main language by default). Shapes are in `entries.schema.ts`; a
summary has `locale` and `originId`, and an `Entry` adds `collectionHandle`, `data`,
`blueprint`, `hasUnpublishedChanges` and `translations` (`[{ id, locale, title, status }]`).

## Languages

Every entry is written in one of its site's locales (`POST` takes `locale`, defaulting to
the main language). A translation is an entry of its own linked to its origin through
`originId`; `POST /entries/:id/translations` starts one as a draft copy, keeping the slug
where it's free and, in a tree, going under the translation of its origin's parent. Slugs
are unique per collection, site and locale, and a parent has to be in the same language.
Deleting an origin leaves its translations as entries of their own. See
`docs/decisions/0007-translations-as-linked-entries.md`.

## References to other content

Entries and terms fields store lists of ids. They are checked on save through
`createContentReferences` (`entry-references.ts`). Deleting an entry (or a term) takes its
id out of every entry's and global set's lists, saved and published values alike, so a
stale id never stops someone saving an unrelated change.

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
`flat` and `tree` collections use `sortOrder`, set by the content tree's `move` and `sort`
(`src/content-tree`) and by new entries going last among their siblings. Trees list depth
first: each page, then its children. (The old `POST /collections/:handle/entries/reorder`
is gone; `move` and `sort` replace it.)
Deleting a page moves its children up to its parent. A parent can be in another collection when
its content type allows that kind of child (`allowedChildren`, see `src/collections`), and a
collection that isn't `allowedAtRoot` can't be created or moved to the top level; both
give 400 `PLACEMENT_NOT_ALLOWED`. Only a change of parent is checked, so an entry placed
before its content type's rules changed still saves. Children of one parent share one
order across collections.

## Duplicating

`duplicate` makes a new draft from the entry's saved values (not its published ones), titled
"… (copy)" (shortened to fit the title's limit), with a slug of its own. It keeps the
parent and goes straight after the original among its siblings; in a dated collection it
sorts by date like any new draft.

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
| `entry-ordering.service.ts`                | Checking parents                                     |
| `entry-publishing.service.ts`              | Publish, unpublish, schedule and `publishDueEntries` |
| `entry-translations.service.ts`            | Starting a translation                               |
| `entry-references.ts`                      | Checking and tidying ids in entries and terms fields |
| `entry-duplication.service.ts`             | "Duplicate entry"                                    |
| `revisions.service.ts`                     | Listing, viewing and restoring revisions             |
| `revision-log.ts`                          | Writing revisions: autosaves gathered per person     |
| `entry-responses.ts`                       | Stored rows to API shapes; `hasUnpublishedChanges`   |
| `slugs.ts`, `entry-tree.ts`                | Pure helpers: making slugs, putting a tree in order  |
| `entries.repository.ts`                    | Database reads and writes for entries                |
| `entry-publishing.repository.ts`           | Finding and claiming due scheduled entries           |
| `revisions.repository.ts`                  | Database reads and writes for revisions              |
| `entries.errors.ts`                        | Named errors with the messages people see            |
| `entries.routes.ts`, `revisions.routes.ts` | The endpoints                                        |
| `translations.routes.ts`                   | `POST /entries/:id/translations`                     |
| `entry-access.ts`                          | `requireEntryPermission`: anyone's, or only your own |

## Your own entries

Saving, publishing (and unpublishing or scheduling), deleting and restoring a revision of
one entry are guarded by `requireEntryPermission`. It allows `entries:update` (and so on)
for any entry, or `entries:update-own` for entries whose `createdBy` is the signed-in person.
That is the Author role: it sees everyone's content, and changes only its own. The editor
gets `createdById` with each entry to show the right buttons.

## Drafts and required fields

Saving never loses work: a draft may leave required fields empty (only the title is
needed, since it names the entry and makes its slug). Publishing and scheduling check the
saved values with every rule and answer 400 `NOT_READY_TO_PUBLISH`, with one message per
field in `fields`, when something is missing. The admin shows those under each field.

## History

Revisions have a `kind`: `edited`, `published`, `unpublished`, `scheduled` or `restored`.
One person's autosaves update a single open `edited` revision; `PATCH` with
`saveVersion: true` (the admin's Cmd/Ctrl+S) keeps the save as a version of its own. A new
revision also starts when someone else edits, after 30 minutes, or when the entry is
published, unpublished, scheduled or restored. See `revision-log.ts` and
`docs/decisions/0011-coalesced-revisions.md`.
