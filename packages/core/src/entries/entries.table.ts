import {
  type AnyPgColumn,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { collectionsTable } from "../collections/collections.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";

/**
 * An entry is one piece of content: a page, a blog post, a case study.
 *
 * - `data` holds the field values, checked against the collection's blueprint before saving.
 * - `originId` links translations: the French version of a page points at the English one.
 * - `parentId` builds the page tree for collections with a "tree" structure.
 */
export const entriesTable = pgTable(
  "entries",
  {
    id: id(),
    tenantId: tenantId(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectionsTable.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id),
    originId: uuid("origin_id").references((): AnyPgColumn => entriesTable.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => entriesTable.id),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["draft", "published", "scheduled"] })
      .notNull()
      .default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    data: jsonb("data").notNull().default({}),
    ...timestamps(),
  },
  (table) => [
    index("entries_collection_site_idx").on(table.collectionId, table.siteId),
    index("entries_slug_idx").on(table.siteId, table.slug),
  ],
);

/**
 * Every save of an entry is kept as a revision, so editors can compare and roll back.
 * `action` records what happened: "saved", "published", "unpublished" or "restored".
 */
export const revisionsTable = pgTable(
  "revisions",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamps().createdAt,
  },
  (table) => [index("revisions_entry_idx").on(table.entryId, table.createdAt)],
);

export type Entry = typeof entriesTable.$inferSelect;
export type NewEntry = typeof entriesTable.$inferInsert;
export type Revision = typeof revisionsTable.$inferSelect;
