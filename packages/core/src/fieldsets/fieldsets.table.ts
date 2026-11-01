import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";

/**
 * A fieldset is a saved set of fields, such as "SEO" or "Call to action", that content types
 * and global sets reuse through a Fieldset field. Its fields are kept on the row, in the same
 * shape as a blueprint's. It holds no values of its own: those live in each entry, under the
 * Fieldset field's handle.
 */
export const fieldsetsTable = pgTable(
  "fieldsets",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    fields: jsonb("fields").$type<FieldDefinition[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("fieldsets_tenant_handle_unique").on(table.tenantId, table.handle)],
);

export type Fieldset = typeof fieldsetsTable.$inferSelect;
export type NewFieldset = typeof fieldsetsTable.$inferInsert;
