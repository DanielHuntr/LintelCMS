# 23. A content tree across collections, and a recycle bin of copies

Date: 2026-11-01

## Decision

The admin's Content section is a tree beside the main navigation, as in Umbraco. Each
collection is a section of the tree, and an entry's children can come from other
collections: a collection lists, in `allowedChildren`, the collections whose entries may
be created under its entries, and says with `allowedAtRoot` whether its entries may sit at
the top of its own section. The server checks both whenever a parent is chosen
(`checkParent` in `src/entries/entry-ordering.service.ts`). Children of one parent share
one order whatever their collection.

Deleting from the tree moves an entry and everything under it to a recycle bin. The bin
keeps a copy of the rows (entries, revisions, search settings) in `recycle_bin_items`, and
the entries are then deleted exactly as before. Restoring inserts the copies again with
their ids, under the old parent when it is still there, as drafts.

## Why

Editors think of a site as pages under pages, with the odd special page among them. One
blueprint per collection stays the rule (delivery, GraphQL and content model files all rely
on it), so mixing kinds of page means letting a parent sit in another collection, which
costs little because addresses don't follow parents.

A `deletedAt` column would have kept binned entries in place, but every query that reads
entries (delivery, GraphQL, search, SEO, menus, the dashboard, content model sync) would
have to learn to skip them, and one that forgot would leak deleted content onto the site.
A copy in a table of its own keeps the rest of Lintel unaware that a bin exists.

## Consequences

- Links to a binned entry from other entries' fields are removed when it is binned, as on
  delete, and aren't put back on restore.
- A restored entry is a draft; nothing reappears on the site until someone publishes it.
- The older `POST /collections/:handle/entries/reorder` still only knows parents in the
  same collection; the tree uses `POST /content-tree/move` and `/content-tree/sort`.
- Emptying the bin, or deleting an item from it, is final.
