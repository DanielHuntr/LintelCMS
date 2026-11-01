# Content tree

What the admin's Content section shows down its left side: every collection as a section,
an entry's children under it (from any collection its content type allows), and the actions
on whole branches. The reasoning is in `docs/decisions/0018-content-tree-and-recycle-bin.md`.

## Endpoints

| Method and path                            | Permission                   | Body or query                                                              | Success                                                            |
| ------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /content-tree`                        | `entries:read`               | `?siteId&locale`                                                           | 200 `{ sites, site, locale, roots, recycleBinCount }`              |
| `GET /content-tree/children`               | `entries:read`               | `?parentId` or `?collection`, `&offset&limit` (≤ 200)                      | 200 `{ items: [TreeNode], total, offset, limit }`                  |
| `GET /content-tree/search`                 | `entries:read`               | `?search`                                                                  | 200 `{ items }`, titles starting with it first                     |
| `GET /content-tree/items`                  | `entries:read`               | `?parentId` or `?collection`, `&search&status&sort&direction&page&perPage` | 200 `{ items, columns, total, page, perPage, canSortByHand }`      |
| `GET /content-tree/allowed-types`          | `entries:read`               | `?parentId`, `?collection` or neither                                      | 200 `{ types: [{ handle, name, blueprintHandle, structure }] }`    |
| `GET /content-tree/entries/:id/path`       | `entries:read`               | none                                                                       | 200 `{ path }`, from the top down to the entry                     |
| `GET /content-tree/entries/:id/info`       | `entries:read`               | none                                                                       | 200 address, people, dates, `usedBy`, `childCount`                 |
| `POST /content-tree/move`                  | `entries:update`             | `{ entryId, parentId, index }`                                             | 200 `{ previous, addressChanges: [{ entryId, title, from, to }] }` |
| `POST /content-tree/sort`                  | `entries:update`             | `{ parentId, collection?, order }`                                         | 204                                                                |
| `POST /content-tree/entries/:id/publish`   | `entries:publish`            | `{ includeDescendants }`                                                   | 200 `{ changed, skipped: [{ id, title, reason }] }`                |
| `POST /content-tree/entries/:id/unpublish` | `entries:publish`            | `{ includeDescendants }`                                                   | 200 the same                                                       |
| `POST /content-tree/entries/:id/duplicate` | `entries:create`             | `{ includeDescendants }`                                                   | 201 `{ entry, copied }`                                            |
| `POST /content-tree/entries/:id/recycle`   | `entries:delete` (or `-own`) | none                                                                       | 201 `{ itemId, entryIds }`, see `src/recycle-bin`                  |
| `POST /content-tree/bulk`                  | the action's own             | `{ action: publish, unpublish, move or recycle, entryIds, parentId? }`     | 200 `{ changed, skipped }`                                         |

`TreeNode = { id, title, slug, status, hasUnpublishedChanges, scheduledFor, updatedAt, parentId, locale, collection: { handle, name }, childCount, childrenAsCollection, isSiteStart }`

`GET /content-tree` also answers `siteStartCount`: pages at the top of a page tree, which
are the site's starts (see `src/content-roots`, which also has the Hostnames endpoints).

## Rules

- **Where things go** comes from each collection (see `src/collections`): `allowedAtRoot`,
  `allowedChildren` and `childrenAsCollection`. Only tree collections have parents. The
  checks are `checkParent`'s, so the editor's parent picker, the API and the tree agree.
- **Reading** is a level at a time: one query for the rows, one grouped count of their
  children. A level of 10,000 entries reads a page at a time, using the
  `entries_parent_sort_idx` index.
- **Order**: children of one parent share one order across collections; a collection's top
  level is ordered by hand (trees and lists) or newest first (dated).
- **Publishing a branch** goes one entry at a time, so one that isn't ready (a required
  field empty, waiting for approval) is reported in `skipped` and the rest still go live.
  Entries already live with nothing new are left alone.
- **Addresses after a move**: `addressChanges` lists the live pages whose address the move
  changed (moving to or from the top can change which site start is "/"). Each is announced
  as `entry.moved`, so the SEO tools suggest a redirect; the admin offers to add them.
- **Bulk actions** need `entries:read` plus the action's own permission.
- **Sites**: the tree shows one site and language; the main one unless `siteId` (and
  `locale`) say otherwise. With more than one site the admin offers a switcher.

## Files

| File                               | What it does                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `content-tree.schema.ts`           | Zod schemas for queries and requests, response shapes     |
| `content-tree.service.ts`          | Sections, levels, search, path, allowed types, move, sort |
| `content-tree-branches.service.ts` | Walking a branch; publishing, unpublishing, duplicating   |
| `collection-view.service.ts`       | The workspace's list: columns, search, sort, pages        |
| `entry-info.service.ts`            | The workspace's Info tab                                  |
| `content-tree.repository.ts`       | Database reads and writes                                 |
| `content-tree.errors.ts`           | Named errors with the messages people see                 |
| `content-tree.routes.ts`           | The endpoints                                             |
