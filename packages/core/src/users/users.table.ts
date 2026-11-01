import { type AnyPgColumn, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { assetsTable } from "../media/media.table.js";

export const userStatuses = ["active", "deactivated"] as const;
export type UserStatus = (typeof userStatuses)[number];

/**
 * People who can sign in to the admin.
 * Shoppers and site members are a different thing and will get their own table later.
 *
 * - `status` "deactivated" keeps the account and its history but stops it signing in.
 * - `avatarAssetId` is a picture from the media library, shown beside the person's name.
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
    status: text("status", { enum: userStatuses }).notNull().default("active"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    avatarAssetId: uuid("avatar_asset_id").references((): AnyPgColumn => assetsTable.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_tenant_email_unique").on(table.tenantId, table.email)],
);

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
