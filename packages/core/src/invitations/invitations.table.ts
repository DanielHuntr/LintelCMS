import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { rolesTable } from "../roles/roles.table.js";
import { usersTable } from "../users/users.table.js";

/**
 * Someone asked to join the admin. The email holds a link with a random token; only its
 * SHA-256 hash is stored. Resending makes a new token and a new expiry, so an old email
 * stops working. Accepting creates the user and deletes the invitation.
 */
export const invitationsTable = pgTable(
  "invitations",
  {
    id: id(),
    tenantId: tenantId(),
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    invitedBy: uuid("invited_by").references(() => usersTable.id, { onDelete: "set null" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("invitations_tenant_email_unique").on(table.tenantId, table.email),
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type Invitation = typeof invitationsTable.$inferSelect;
export type NewInvitation = typeof invitationsTable.$inferInsert;
