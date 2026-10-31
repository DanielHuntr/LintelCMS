import { integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/**
 * A blueprint describes the fields a piece of content has: "a blog post has a title,
 * a hero image and a body". It is data, not code, so people can build one in the admin.
 *
 * `version` goes up every time the fields change, so an old revision of an entry can
 * still be shown with the fields it was saved with.
 */
export const blueprintsTable = pgTable(
  "blueprints",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    // What the blueprint is for: an entry, a taxonomy term, a global set, a form, a product...
    kind: text("kind").notNull(),
    fields: jsonb("fields").notNull().default([]),
    version: integer("version").notNull().default(1),
    ...timestamps(),
  },
  (table) => [uniqueIndex("blueprints_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Blueprint = typeof blueprintsTable.$inferSelect;
export type NewBlueprint = typeof blueprintsTable.$inferInsert;
