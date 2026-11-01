import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";

/**
 * Where a site start (a page at the top of a page tree) answers, as set in its "Hostnames":
 * a domain ("shop.example.com"), a path prefix ("/shop"), or both. Empty means not set.
 * A site start without a row here takes the default (see root-addresses.ts).
 *
 * The row goes with its entry: deleting the page deletes it.
 */
export const contentRootAddressesTable = pgTable(
  "content_root_addresses",
  {
    id: id(),
    tenantId: tenantId(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entriesTable.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull().default(""),
    pathPrefix: text("path_prefix").notNull().default(""),
    ...timestamps(),
  },
  (table) => [uniqueIndex("content_root_addresses_entry_unique").on(table.tenantId, table.entryId)],
);

export type ContentRootAddressRow = typeof contentRootAddressesTable.$inferSelect;
