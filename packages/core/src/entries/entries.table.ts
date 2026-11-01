import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { collectionsTable } from "../collections/collections.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";

/** Field values keyed by field handle, checked against the blueprint before saving. */
export type EntryData = Record<string, unknown>;

export const entryStatuses = ["draft", "published", "scheduled"] as const;
export type EntryStatus = (typeof entryStatuses)[number];

/**
 * An entry is one piece of content: a page, a blog post, a case study.
 *
 * - `data` holds the field values as last saved: the working copy editors see.
 * - `publishedData` is a copy of `data` taken when the entry was last published. The
 *   public delivery API serves only this, so saving a change to a live page doesn't put
 *   it on the site until someone publishes again. Null while nothing is live.
 * - `scheduledFor` is when a "scheduled" entry will be published (see src/scheduler).
 * - `sortOrder` is the entry's place among its siblings, for "tree" and "flat" collections.
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
    status: text("status", { enum: entryStatuses }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    data: jsonb("data").$type<EntryData>().notNull().default({}),
    publishedData: jsonb("published_data").$type<EntryData>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    index("entries_collection_site_idx").on(table.collectionId, table.siteId),
    // Slugs are unique per collection and site, so "/blog/hello" can only mean one post.
    uniqueIndex("entries_collection_site_slug_unique").on(
      table.tenantId,
      table.collectionId,
      table.siteId,
      table.slug,
    ),
    // The scheduler looks for scheduled entries that are due, every minute.
    index("entries_status_scheduled_for_idx").on(table.status, table.scheduledFor),
  ],
);

export const revisionActions = ["saved", "published", "unpublished", "restored"] as const;
export type RevisionAction = (typeof revisionActions)[number];

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
    action: text("action", { enum: revisionActions }).notNull(),
    data: jsonb("data").$type<EntryData>().notNull(),
    createdAt: timestamps().createdAt,
  },
  (table) => [index("revisions_entry_idx").on(table.entryId, table.createdAt)],
);

export type Entry = typeof entriesTable.$inferSelect;
export type NewEntry = typeof entriesTable.$inferInsert;
export type Revision = typeof revisionsTable.$inferSelect;
