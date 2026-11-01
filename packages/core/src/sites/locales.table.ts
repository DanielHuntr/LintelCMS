import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { sitesTable } from "./sites.table.js";

/**
 * The languages a site is written in, such as "en-GB" and "fr-FR". Every site has at least
 * one: its default, named by `sites.locale`, which is also a row here. Entries and global
 * values are kept per locale. See docs/decisions/0007-translations-as-linked-entries.md.
 */
export const siteLocalesTable = pgTable(
  "site_locales",
  {
    id: id(),
    tenantId: tenantId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    /** A BCP 47 language tag, such as "en-GB" or "fr". */
    code: text("code").notNull(),
    /** What editors see, such as "French". */
    name: text("name").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("site_locales_site_code_unique").on(table.siteId, table.code)],
);

export type SiteLocale = typeof siteLocalesTable.$inferSelect;
export type NewSiteLocale = typeof siteLocalesTable.$inferInsert;
