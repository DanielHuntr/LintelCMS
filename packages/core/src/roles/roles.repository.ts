import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type NewRole, type Role, rolesTable, userRolesTable } from "./roles.table.js";

/** Database reads and writes for roles and role assignments, nothing else. */

export async function findRoleByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Role | undefined> {
  const [role] = await database
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.tenantId, tenantId), eq(rolesTable.handle, handle)))
    .limit(1);
  return role;
}

export async function insertRole(database: DatabaseOrTransaction, role: NewRole): Promise<Role> {
  const [inserted] = await database.insert(rolesTable).values(role).returning();
  if (!inserted) {
    throw new Error("The database did not return the new role.");
  }
  return inserted;
}

export async function assignRoleToUser(
  database: DatabaseOrTransaction,
  userId: string,
  roleId: string,
): Promise<void> {
  await database.insert(userRolesTable).values({ userId, roleId }).onConflictDoNothing();
}

/** The permission lists of every role the user has, one list per role. */
export async function findPermissionListsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<string[][]> {
  const rows = await database
    .select({ permissions: rolesTable.permissions })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, userId));
  return rows.map((row) => row.permissions);
}
