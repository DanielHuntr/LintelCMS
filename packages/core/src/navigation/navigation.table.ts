import { integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import type { NavigationItem } from "./navigation.schema.js";

/**
 * A navigation menu, such as the main menu or the footer links. Its items are a small
 * tree, kept as one JSON value and saved whole: menus are edited all at once in the admin,
 * and read all at once by websites, so there is nothing to gain from a row per item.
 *
 * `maxDepth` is how many levels the menu may have: 1 for a flat footer, 2 or 3 for a main
 * menu with drop-downs.
 */
export const navigationsTable = pgTable(
  "navigations",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    maxDepth: integer("max_depth").notNull().default(3),
    items: jsonb("items").$type<NavigationItem[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("navigations_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Navigation = typeof navigationsTable.$inferSelect;
export type NewNavigation = typeof navigationsTable.$inferInsert;
