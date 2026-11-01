import { boolean, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * A role is a named set of permissions, such as "Editor" or "Store manager".
 * Permissions are plain strings (see permissions.ts) so they are easy to read in the database.
 *
 * - `isBuiltIn` marks Owner, Admin, Editor, Author and Viewer (see built-in-roles.ts): their
 *   permissions are fixed and they can't be deleted.
 * - `requiresTwoFactor` makes everyone with the role turn on two-factor authentication.
 */
export const rolesTable = pgTable(
  "roles",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isBuiltIn: boolean("is_built_in").notNull().default(false),
    requiresTwoFactor: boolean("requires_two_factor").notNull().default(false),
    permissions: text("permissions").array().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("roles_tenant_handle_unique").on(table.tenantId, table.handle)],
);

/** Which users have which roles. A user can have several. */
export const userRolesTable = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export type Role = typeof rolesTable.$inferSelect;
export type NewRole = typeof rolesTable.$inferInsert;
