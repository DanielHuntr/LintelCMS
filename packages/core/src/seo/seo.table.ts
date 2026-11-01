import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import { assetsTable } from "../media/media.table.js";
import { redirectSources, redirectStatuses } from "./redirects.schema.js";

/**
 * An entry's search engine settings, from the SEO panel in the editor. Empty values fall
 * back to the site defaults (the `seoDefaults` setting). They take effect when saved, like
 * an entry's slug, rather than waiting for the next publish.
 */
export const entrySeoTable = pgTable(
  "entry_seo",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    socialImageId: uuid("social_image_id").references(() => assetsTable.id, {
      onDelete: "set null",
    }),
    noindex: boolean("noindex").notNull().default(false),
    ...timestamps(),
  },
  (table) => [uniqueIndex("entry_seo_tenant_entry_unique").on(table.tenantId, table.entryId)],
);

/**
 * "Send people asking for /old-page to /new-page." Websites read the active ones from
 * the delivery API and answer with the status code (301 for moved for good, 302 for now).
 *
 * `status` is "suggested" for redirects Lintel proposed itself, when a live page's
 * address changed; they do nothing until someone accepts them.
 */
export const redirectsTable = pgTable(
  "redirects",
  {
    id: id(),
    tenantId: tenantId(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    status: text("status", { enum: redirectStatuses }).notNull().default("active"),
    source: text("source", { enum: redirectSources }).notNull().default("manual"),
    /** The entry whose move suggested this redirect, if one did. */
    entryId: uuid("entry_id").references(() => entriesTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    // One rule per address, so it's never a guess which one a website should follow.
    uniqueIndex("redirects_tenant_from_unique").on(table.tenantId, table.fromPath),
    index("redirects_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export type EntrySeoRow = typeof entrySeoTable.$inferSelect;
export type RedirectRow = typeof redirectsTable.$inferSelect;
export type NewRedirectRow = typeof redirectsTable.$inferInsert;
