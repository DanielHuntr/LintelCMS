import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import { apiTokenAccessLevels } from "./api-tokens.schema.js";

/**
 * A key a website, app or script sends as `Authorization: Bearer <token>`.
 *
 * Only a SHA-256 hash of the token is kept, so a copy of the database can't be used to
 * call the API. The token itself is shown once, when it is made. Tokens are long and
 * random, so a fast hash is enough; slow password hashing is for things people choose.
 *
 * A token acts for the admin who made it and never has more access than they do. When
 * that admin's account is deleted, their tokens go with it.
 */
export const apiTokensTable = pgTable(
  "api_tokens",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    access: text("access", { enum: apiTokenAccessLevels }).notNull(),
    tokenHash: text("token_hash").notNull(),
    /** The first few characters, so people can tell their tokens apart. */
    tokenStart: text("token_start").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("api_tokens_token_hash_unique").on(table.tokenHash),
    index("api_tokens_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type ApiTokenRow = typeof apiTokensTable.$inferSelect;
export type NewApiTokenRow = typeof apiTokensTable.$inferInsert;
