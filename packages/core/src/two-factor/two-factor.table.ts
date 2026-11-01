import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * One row per person who has started or finished setting up an authenticator app.
 *
 * - `pendingSecret` is the key shown as a QR code, until a first code proves it was saved.
 * - `secret` is the confirmed key; `enabledAt` says when two-factor was turned on.
 * - `lastUsedStep` is the 30-second window of the last accepted code, so a code someone
 *   watched being typed can't be used a second time.
 */
export const twoFactorTable = pgTable("two_factor", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tenantId: tenantId(),
  secret: text("secret"),
  pendingSecret: text("pending_secret"),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  lastUsedStep: integer("last_used_step"),
  ...timestamps(),
});

/**
 * Codes for when the phone is lost. Each works once; only a hash is stored. Making a new
 * set deletes the old one.
 */
export const recoveryCodesTable = pgTable(
  "recovery_codes",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recovery_codes_user_idx").on(table.userId)],
);

export type TwoFactorRow = typeof twoFactorTable.$inferSelect;
export type RecoveryCodeRow = typeof recoveryCodesTable.$inferSelect;
