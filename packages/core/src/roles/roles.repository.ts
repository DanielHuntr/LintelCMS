import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
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

export async function findRoleById(
  database: DatabaseOrTransaction,
  tenantId: string,
  roleId: string,
): Promise<Role | undefined> {
  const [role] = await database
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.tenantId, tenantId), eq(rolesTable.id, roleId)))
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

/** Adds a role, or brings an existing one with the same handle in line with it. */
export async function upsertRoleByHandle(
  database: DatabaseOrTransaction,
  role: NewRole & { tenantId: string; handle: string },
): Promise<void> {
  await database
    .insert(rolesTable)
    .values(role)
    .onConflictDoUpdate({
      target: [rolesTable.tenantId, rolesTable.handle],
      set: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isBuiltIn: role.isBuiltIn,
      },
    });
}

export async function updateRoleRow(
  database: DatabaseOrTransaction,
  roleId: string,
  changes: Partial<Pick<Role, "name" | "description" | "permissions" | "requiresTwoFactor">>,
): Promise<Role | undefined> {
  const [updated] = await database
    .update(rolesTable)
    .set(changes)
    .where(eq(rolesTable.id, roleId))
    .returning();
  return updated;
}

export async function deleteRoleRow(database: DatabaseOrTransaction, roleId: string) {
  await database.delete(rolesTable).where(eq(rolesTable.id, roleId));
}

export async function listRoleRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Array<Role & { memberCount: number }>> {
  const roles = await database
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.tenantId, tenantId))
    .orderBy(asc(rolesTable.createdAt), asc(rolesTable.name));
  const counts = await database
    .select({ roleId: userRolesTable.roleId, members: count() })
    .from(userRolesTable)
    .groupBy(userRolesTable.roleId);
  const countByRole = new Map(counts.map((row) => [row.roleId, row.members]));
  return roles.map((role) => ({ ...role, memberCount: countByRole.get(role.id) ?? 0 }));
}

export async function assignRoleToUser(
  database: DatabaseOrTransaction,
  userId: string,
  roleId: string,
): Promise<void> {
  await database.insert(userRolesTable).values({ userId, roleId }).onConflictDoNothing();
}

/** Gives the user exactly this one role, replacing any others. */
export async function replaceRolesOfUser(
  database: DatabaseOrTransaction,
  userId: string,
  roleId: string,
): Promise<void> {
  await database.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
  await database.insert(userRolesTable).values({ userId, roleId });
}

/** The roles of each of these users. */
export async function findRolesForUsers(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<Array<Role & { userId: string }>> {
  if (userIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ role: rolesTable, userId: userRolesTable.userId })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(inArray(userRolesTable.userId, [...userIds]))
    .orderBy(asc(rolesTable.createdAt));
  return rows.map((row) => ({ ...row.role, userId: row.userId }));
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

/** Active users who have the role with this handle. */
export async function findActiveUserIdsWithRole(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<string[]> {
  const rows = await database
    .select({ userId: userRolesTable.userId })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(
      and(
        eq(rolesTable.tenantId, tenantId),
        eq(rolesTable.handle, handle),
        eq(usersTable.status, "active"),
      ),
    );
  return rows.map((row) => row.userId);
}

/** The sites each of the user's roles is limited to, one entry per role (null for every site). */
export async function findSiteListsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<(string[] | null)[]> {
  const rows = await database
    .select({ siteIds: rolesTable.siteIds })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, userId));
  return rows.map((row) => row.siteIds);
}

export async function updateRoleSiteIds(
  database: DatabaseOrTransaction,
  roleId: string,
  siteIds: string[] | null,
): Promise<void> {
  await database
    .update(rolesTable)
    .set({ siteIds, updatedAt: new Date() })
    .where(eq(rolesTable.id, roleId));
}

/** Takes a deleted site out of every role limited to it. */
export async function removeSiteFromRoles(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<void> {
  await database
    .update(rolesTable)
    .set({ siteIds: sql`array_remove(${rolesTable.siteIds}, ${siteId}::uuid)` })
    .where(sql`${siteId}::uuid = any(${rolesTable.siteIds})`);
}
