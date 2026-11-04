import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type NewRole,
  type Role,
  rolesTable as rolesDefinition,
  userRolesTable as userRolesDefinition,
} from "./roles.table.js";
import {
  insertIfNew,
  insertReturning,
  updateReturning,
  upsert,
} from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { idListIncludes, idListWithout } from "../database/dialect/expressions.js";

/** Database reads and writes for roles and role assignments, nothing else. */

export async function findRoleByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Role | undefined> {
  const rolesTable = tableFor(database, rolesDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
  const [role] = await database
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.tenantId, tenantId), eq(rolesTable.id, roleId)))
    .limit(1);
  return role;
}

export async function insertRole(database: DatabaseOrTransaction, role: NewRole): Promise<Role> {
  const rolesTable = tableFor(database, rolesDefinition);
  const [inserted] = await insertReturning(database, rolesTable, role);
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
  const rolesTable = tableFor(database, rolesDefinition);
  await upsert(database, rolesTable, role, {
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
  const rolesTable = tableFor(database, rolesDefinition);
  const [updated] = await updateReturning(database, rolesTable, changes, eq(rolesTable.id, roleId));
  return updated;
}

export async function deleteRoleRow(database: DatabaseOrTransaction, roleId: string) {
  const rolesTable = tableFor(database, rolesDefinition);
  await database.delete(rolesTable).where(eq(rolesTable.id, roleId));
}

export async function listRoleRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Array<Role & { memberCount: number }>> {
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
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
  const userRolesTable = tableFor(database, userRolesDefinition);
  await insertIfNew(database, userRolesTable, { userId, roleId });
}

/** Gives the user exactly this one role, replacing any others. */
export async function replaceRolesOfUser(
  database: DatabaseOrTransaction,
  userId: string,
  roleId: string,
): Promise<void> {
  const userRolesTable = tableFor(database, userRolesDefinition);
  await database.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
  await database.insert(userRolesTable).values({ userId, roleId });
}

/** The roles of each of these users. */
export async function findRolesForUsers(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<Array<Role & { userId: string }>> {
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
  const usersTable = tableFor(database, usersDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
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
  const rolesTable = tableFor(database, rolesDefinition);
  await database
    .update(rolesTable)
    .set({ siteIds: idListWithout(database, rolesTable.siteIds, siteId) })
    .where(idListIncludes(database, rolesTable.siteIds, siteId));
}
