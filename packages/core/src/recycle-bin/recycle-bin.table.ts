import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { collectionsTable } from "../collections/collections.table.js";
import { id, tenantId } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * What a binned entry was, with everything under it, so it can come back exactly where it
 * was. Dates are ISO strings, as JSON keeps them. See recycle-bin.service.ts.
 */
export interface BinnedBranch {
  entries: BinnedEntry[];
  revisions: BinnedRevision[];
  seo: BinnedSeo[];
}

export interface BinnedEntry {
  id: string;
  collectionId: string;
  siteId: string;
  locale: string;
  originId: string | null;
  parentId: string | null;
  slug: string;
  data: Record<string, unknown>;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BinnedRevision {
  id: string;
  entryId: string;
  authorId: string | null;
  kind: string;
  data: Record<string, unknown>;
  restoredFromAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BinnedSeo {
  entryId: string;
  title: string;
  description: string;
  socialImageId: string | null;
  noindex: boolean;
}

/**
 * The recycle bin: entries deleted from the content tree, each row one entry with
 * everything that was under it. `entryId` and `parentId` are the ids it had (and gets
 * back when restored). Deleting the collection empties its part of the bin.
 */
export const recycleBinItemsTable = pgTable(
  "recycle_bin_items",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id").notNull(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectionsTable.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    /** The entry and everything under it. */
    itemCount: integer("item_count").notNull(),
    branch: jsonb("branch").$type<BinnedBranch>().notNull(),
    deletedBy: uuid("deleted_by").references(() => usersTable.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recycle_bin_items_tenant_deleted_idx").on(table.tenantId, table.deletedAt)],
);

export type RecycleBinItem = typeof recycleBinItemsTable.$inferSelect;
export type NewRecycleBinItem = typeof recycleBinItemsTable.$inferInsert;
