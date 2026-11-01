import { pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";

/**
 * A role is a named set of permissions, such as "Editor" or "Store manager".
 * Permissions are plain strings (see permissions.ts) so they are easy to read in the database.
 *
 * `siteIds` limits the role to some sites: null means every site, which is how every role
 * starts. Someone with several roles may work on every site any of them allows.
 */
export const rolesTable = pgTable(
  "roles",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    permissions: text("permissions").array().notNull().default([]),
    siteIds: uuid("site_ids").array(),
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
