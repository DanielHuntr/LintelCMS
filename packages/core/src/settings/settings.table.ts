import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/**
 * Small site-wide settings, one row per setting, such as which plugins are switched on.
 * Values are JSON so a new setting needs no new column; each key's shape is checked by
 * its Zod schema in settings.schema.ts whenever it is read or written.
 */
export const settingsTable = pgTable(
  "settings",
  {
    id: id(),
    tenantId: tenantId(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("settings_tenant_key_unique").on(table.tenantId, table.key)],
);

export type Setting = typeof settingsTable.$inferSelect;
