import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
 * - `locale` is the language the entry is written in, one of its site's locales.
 * - `originId` links translations: the French version of a page points at the English one.
 *   See docs/decisions/0007-translations-as-linked-entries.md.
 * - `parentId` builds the page tree for collections with a "tree" structure.
 * - `version` goes up with every change to the row, whatever makes it, so someone saving can
 *   say which version they started from and never overwrite a change they haven't seen.
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
    // Entries from before languages existed were in the default site's language, en-GB.
    locale: text("locale").notNull().default("en-GB"),
    originId: uuid("origin_id").references((): AnyPgColumn => entriesTable.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => entriesTable.id),
    slug: text("slug").notNull(),
    status: text("status", { enum: entryStatuses }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    data: jsonb("data").$type<EntryData>().notNull().default({}),
    publishedData: jsonb("published_data").$type<EntryData>(),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version")
      .notNull()
      .default(1)
      .$onUpdate(() => sql`version + 1`),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    index("entries_collection_site_idx").on(table.collectionId, table.siteId),
    // Slugs are unique per collection, site and locale, so "/blog/hello" can only mean one
    // post in each language, and a translation can keep its origin's slug.
    uniqueIndex("entries_collection_site_locale_slug_unique").on(
      table.tenantId,
      table.collectionId,
      table.siteId,
      table.locale,
      table.slug,
    ),
    index("entries_origin_idx").on(table.originId),
    // The content tree reads children by parent, in their order.
    index("entries_parent_sort_idx").on(table.parentId, table.sortOrder),
    // The scheduler looks for scheduled entries that are due, every minute.
    index("entries_status_scheduled_for_idx").on(table.status, table.scheduledFor),
  ],
);

export const revisionKinds = [
  "edited",
  "published",
  "unpublished",
  "scheduled",
  "restored",
  "kept",
] as const;
export type RevisionKind = (typeof revisionKinds)[number];

/**
 * The history of an entry, so editors can see what changed and roll back. `kind` says what
 * happened; "kept" is a version someone set aside when they chose another person's changes. Autosaves don't each make a revision: they keep updating one open "edited"
 * revision per person (see revisions.service.ts and docs/decisions/0011).
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
    kind: text("kind", { enum: revisionKinds }).notNull().default("edited"),
    data: jsonb("data").$type<EntryData>().notNull(),
    /**
     * An "edited" revision that later autosaves by the same person may still update. Closed
     * when they press Save version, or when anything else happens to the entry.
     */
    isOpen: boolean("is_open").notNull().default(false),
    /** For "restored": when the revision that was restored was made. */
    restoredFromAt: timestamp("restored_from_at", { withTimezone: true }),
    createdAt: timestamps().createdAt,
    /** Moves on when an open revision takes a later autosave; the time History shows. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("revisions_entry_idx").on(table.entryId, table.createdAt)],
);

export type Entry = typeof entriesTable.$inferSelect;
export type NewEntry = typeof entriesTable.$inferInsert;
export type Revision = typeof revisionsTable.$inferSelect;
