import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * A session is one signed-in browser. The browser holds a random token in a cookie;
 * the database holds only a SHA-256 hash of it, so a leaked database backup can't be
 * used to sign in as anyone. See docs/decisions/0004.
 *
 * - `expiresAt` slides forward when the session is used (at most once a day).
 * - `lastUsedAt` shows people where they are signed in, and drives the sliding expiry.
 * - `userAgent` is only for display ("Firefox on Windows"), never for security checks.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export type Session = typeof sessionsTable.$inferSelect;
export type NewSession = typeof sessionsTable.$inferInsert;
