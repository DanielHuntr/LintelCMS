import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/**
 * A site is one website served by this install, in one language.
 * "Acme UK in English" and "Acme France in French" are two rows.
 * `fallbackLocale` is the language shown when a translation is missing.
 */
export const sitesTable = pgTable(
  "sites",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    locale: text("locale").notNull().default("en-GB"),
    fallbackLocale: text("fallback_locale"),
    ...timestamps(),
  },
  (table) => [uniqueIndex("sites_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Site = typeof sitesTable.$inferSelect;
export type NewSite = typeof sitesTable.$inferInsert;
