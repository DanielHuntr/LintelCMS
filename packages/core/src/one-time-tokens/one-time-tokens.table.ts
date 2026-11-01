import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

export const oneTimeTokenPurposes = [
  "password-reset",
  "email-change",
  "two-factor-sign-in",
  "passkey-registration",
  "passkey-sign-in",
] as const;
export type OneTimeTokenPurpose = (typeof oneTimeTokenPurposes)[number];

/** Extra facts a token carries, such as the address an email change is moving to. */
export interface OneTimeTokenDetails {
  newEmail?: string;
}

/**
 * Short-lived secrets that can be used once: password reset links, email change links,
 * the step between a password and a two-factor code, and passkey challenges.
 *
 * Only a SHA-256 hash is stored, as for sessions, so a copy of the database can't be used
 * to reset anyone's password. `usedAt` is set the moment a token is spent.
 */
export const oneTimeTokensTable = pgTable(
  "one_time_tokens",
  {
    id: id(),
    tenantId: tenantId(),
    purpose: text("purpose", { enum: oneTimeTokenPurposes }).notNull(),
    // Passkey sign-in starts before anyone is known, so its challenges have no user.
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    details: jsonb("details").$type<OneTimeTokenDetails>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("one_time_tokens_token_hash_unique").on(table.tokenHash),
    index("one_time_tokens_user_purpose_idx").on(table.userId, table.purpose),
  ],
);

export type OneTimeToken = typeof oneTimeTokensTable.$inferSelect;
export type NewOneTimeToken = typeof oneTimeTokensTable.$inferInsert;
