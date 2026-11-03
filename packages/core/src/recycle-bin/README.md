# Recycle bin

Deleting from the content tree (`POST /content-tree/entries/:id/recycle`) moves an entry
and everything under it here. The bin keeps a copy of their rows (values, history, search
settings) in `recycle_bin_items`, then deletes the entries the way `DELETE /entries/:id`
always has, so nothing else in Lintel has to know about the bin. See
`docs/decisions/0023-content-tree-and-recycle-bin.md`. Files from the media library have a
bin of their own, `GET /media-bin` (see `src/media/README.md`).

## Endpoints

| Method and path                 | Permission       | Success                                                                                              |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /recycle-bin`              | `entries:read`   | 200 `{ items: [{ id, entryId, title, collection, itemCount, deletedAt, deletedBy }] }`, newest first |
| `POST /recycle-bin/:id/restore` | `entries:create` | 200 `{ entryId, parentId, restoredCount }`; body `{ asBefore? }`                                     |
| `DELETE /recycle-bin/:id`       | `entries:delete` | 204, gone for good                                                                                   |
| `DELETE /recycle-bin`           | `entries:delete` | 200 `{ deleted }`, the bin emptied                                                                   |

## Restoring

- The entries come back with their ids, history and search settings, **as drafts**, so
  nothing reappears on the site until someone publishes it.
- **Undo** is different: the admin's Undo, straight after binning, sends `asBefore: true`.
  The entry goes back to its old place among its siblings rather than last, and, for
  someone with `entries:publish`, what was live is live again showing what it showed
  (`entry.published` is announced for each). Without that permission it comes back as a
  draft. Items binned before this was kept come back as drafts too.
- The top entry goes back under its old parent if that is still there, else to the top of
  its collection. Everything under it keeps its place.
- A slug taken meanwhile gets a number (`about-2`). People removed meanwhile are left out
  of "created by" and the history.
- If a content type in the branch was deleted, restoring answers 409 `COLLECTION_GONE`.
  Deleting a collection empties its part of the bin.
- Links to the entries from other entries' fields were removed when they were binned, as
  on delete, and aren't put back.

## Files

| File                        | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `recycle-bin.table.ts`      | The `recycle_bin_items` table and the copy's shape |
| `recycle-bin.service.ts`    | Binning, restoring, deleting for good, emptying    |
| `recycle-bin.repository.ts` | Database reads and writes                          |
| `recycle-bin.errors.ts`     | Named errors with the messages people see          |
| `recycle-bin.routes.ts`     | The endpoints                                      |
