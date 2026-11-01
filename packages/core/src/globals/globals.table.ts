import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";

/**
 * A global set is a group of fields with one value each for the whole site, such as
 * "Site settings": the site's name, the footer text, the social links. Unlike entries
 * there is no list, no slug and no publishing step: saving puts the values live.
 *
 * Its fields are kept on the row, in the same shape as a blueprint's, and are checked by
 * the same fieldtypes.
 */
export const globalSetsTable = pgTable(
  "global_sets",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    fields: jsonb("fields").$type<FieldDefinition[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("global_sets_tenant_handle_unique").on(table.tenantId, table.handle)],
);

/**
 * A global set's values for one site, in one language. A language without a row uses the
 * site's main language's. The set's fields are shared by every site; the values are not.
 */
export const globalValuesTable = pgTable(
  "global_values",
  {
    id: id(),
    tenantId: tenantId(),
    globalSetId: uuid("global_set_id")
      .notNull()
      .references(() => globalSetsTable.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sitesTable.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("global_values_set_site_locale_unique").on(
      table.globalSetId,
      table.siteId,
      table.locale,
    ),
  ],
);

export type GlobalSet = typeof globalSetsTable.$inferSelect;
export type NewGlobalSet = typeof globalSetsTable.$inferInsert;
export type GlobalValues = typeof globalValuesTable.$inferSelect;
