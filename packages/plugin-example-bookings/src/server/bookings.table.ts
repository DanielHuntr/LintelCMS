import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "@lintel/core/plugin";

/**
 * One appointment: who, when and for how long. Like every Lintel table it has `tenantId`
 * (see Lintel's docs/decisions/0003). Its name starts with the plugin id, as Lintel asks.
 */
export const bookingsTable = pgTable(
  "bookings",
  {
    id: id(),
    tenantId: tenantId(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    notes: text("notes").notNull().default(""),
    ...timestamps(),
  },
  (table) => [index("bookings_tenant_starts_at_idx").on(table.tenantId, table.startsAt)],
);

export type BookingRow = typeof bookingsTable.$inferSelect;
export type NewBookingRow = typeof bookingsTable.$inferInsert;
