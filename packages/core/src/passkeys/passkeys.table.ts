import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * A passkey: a key pair kept by a phone, laptop or security key. Lintel keeps only the
 * public half, so there is nothing here that could be used to sign in.
 *
 * - `credentialId` is the authenticator's id for the key (base64url), unique everywhere.
 * - `counter` is the authenticator's signature count, which shows up a cloned key.
 */
export const passkeysTable = pgTable(
  "passkeys",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").array().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("passkeys_credential_id_unique").on(table.credentialId),
    index("passkeys_user_idx").on(table.userId),
  ],
);

export type PasskeyRow = typeof passkeysTable.$inferSelect;
export type NewPasskeyRow = typeof passkeysTable.$inferInsert;
