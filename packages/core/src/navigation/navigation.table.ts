import { integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { sitesTable } from "../sites/sites.table.js";
import type { NavigationItem } from "./navigation.schema.js";

/**
 * A navigation menu, such as the main menu or the footer links. Its items are a small
 * tree, kept as one JSON value and saved whole: menus are edited all at once in the admin,
 * and read all at once by websites, so there is nothing to gain from a row per item.
 *
 * `maxDepth` is how many levels the menu may have: 1 for a flat footer, 2 or 3 for a main
 * menu with drop-downs.
 *
 * Each site has its own menus: "main" on the UK site and "main" on the French site are two
 * rows, so a website asks for the same handle whichever site it is.
 */
export const navigationsTable = pgTable(
  "navigations",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    maxDepth: integer("max_depth").notNull().default(3),
    items: jsonb("items").$type<NavigationItem[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("navigations_site_handle_unique").on(table.tenantId, table.siteId, table.handle),
  ],
);

export type Navigation = typeof navigationsTable.$inferSelect;
export type NewNavigation = typeof navigationsTable.$inferInsert;
