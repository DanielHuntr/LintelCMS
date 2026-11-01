import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { sitesTable } from "../sites/sites.table.js";

/**
 * A taxonomy is a way of grouping content: "Categories", "Tags", "Topics". Its terms are
 * the groups themselves ("News", "Guides"). Entries choose terms through a field of type
 * `terms`, which stores their ids.
 *
 * `siteId` is null for a taxonomy every site shares, or the one site it belongs to. Handles
 * are unique across the install either way, so a terms field always means one taxonomy.
 */
export const taxonomiesTable = pgTable(
  "taxonomies",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("taxonomies_tenant_handle_unique").on(table.tenantId, table.handle)],
);

/**
 * One term of a taxonomy. Terms have a fixed, small set of fields (title, slug and an
 * optional description) rather than a blueprint, which is all categories and tags need.
 * The slug is unique within the taxonomy, so "/blog/category/news" means one term.
 */
export const termsTable = pgTable(
  "terms",
  {
    id: id(),
    tenantId: tenantId(),
    taxonomyId: uuid("taxonomy_id")
      .notNull()
      .references(() => taxonomiesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("terms_taxonomy_slug_unique").on(table.tenantId, table.taxonomyId, table.slug),
    index("terms_taxonomy_idx").on(table.taxonomyId),
  ],
);

export type Taxonomy = typeof taxonomiesTable.$inferSelect;
export type NewTaxonomy = typeof taxonomiesTable.$inferInsert;
export type Term = typeof termsTable.$inferSelect;
export type NewTerm = typeof termsTable.$inferInsert;
