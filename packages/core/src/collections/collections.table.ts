import { boolean, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { collectionStructures } from "./collections.schema.js";
import { id, tenantId, timestamps } from "../database/columns.js";
import { blueprintsTable } from "../blueprints/blueprints.table.js";

/**
 * A collection is a group of entries that share a blueprint: Pages, Blog, Case studies.
 *
 * `structure` decides how entries are arranged:
 *   - "tree"  parent and child pages, like a site's page hierarchy
 *   - "dated" ordered by date, like a blog
 *   - "flat"  a simple list, ordered by hand
 *
 * Where its entries may go in the content tree (see src/content-tree):
 *   - `allowedAtRoot`  entries can sit at the top of the collection's own section
 *   - `allowedChildren` handles of the collections whose entries may go under one of these
 *   - `childrenAsCollection` children are shown as a list in the workspace, not in the tree
 *   - `listColumns` the fields shown as columns in that list, by handle
 */
export const collectionsTable = pgTable(
  "collections",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => blueprintsTable.id),
    routePattern: text("route_pattern"),
    // Where the website shows unpublished drafts, for live preview. See src/preview.
    previewUrlPattern: text("preview_url_pattern"),
    structure: text("structure", { enum: collectionStructures }).notNull().default("flat"),
    allowedAtRoot: boolean("allowed_at_root").notNull().default(true),
    allowedChildren: jsonb("allowed_children").$type<string[]>().notNull().default([]),
    childrenAsCollection: boolean("children_as_collection").notNull().default(false),
    listColumns: jsonb("list_columns").$type<string[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("collections_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Collection = typeof collectionsTable.$inferSelect;
export type NewCollection = typeof collectionsTable.$inferInsert;
