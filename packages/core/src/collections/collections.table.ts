import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    ...timestamps(),
  },
  (table) => [uniqueIndex("collections_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Collection = typeof collectionsTable.$inferSelect;
export type NewCollection = typeof collectionsTable.$inferInsert;
