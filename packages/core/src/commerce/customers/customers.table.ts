import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import type { Address } from "./address.schema.js";

/**
 * Someone who has bought from the shop. Found by email (stored lowercase), so a second
 * order from the same address joins the first. Their delivery addresses are remembered,
 * newest first, without duplicates.
 */
export const customersTable = pgTable(
  "shop_customers",
  {
    id: id(),
    tenantId: tenantId(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    addresses: jsonb("addresses").$type<Address[]>().notNull().default([]),
    note: text("note").notNull().default(""),
    ...timestamps(),
  },
  (table) => [uniqueIndex("shop_customers_email_idx").on(table.tenantId, table.email)],
);

export type CustomerRow = typeof customersTable.$inferSelect;
