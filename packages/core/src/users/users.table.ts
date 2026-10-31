import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";

/**
 * People who can sign in to the admin.
 * Shoppers and site members are a different thing and will get their own table later.
 */
export const usersTable = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Null until the user sets a password; magic-link-only users never have one.
    passwordHash: text("password_hash"),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_tenant_email_unique").on(table.tenantId, table.email)],
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
