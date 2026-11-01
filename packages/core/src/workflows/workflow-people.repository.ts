import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { rolesTable, userRolesTable } from "../roles/roles.table.js";
import { usersTable } from "../users/users.table.js";

/**
 * Reads about people that workflows need: who has a role (to notify or ask them), and
 * which roles someone has (for "the person has the role" conditions). Reads only.
 */

export interface Person {
  id: string;
  name: string;
  email: string;
}

export async function listPeopleWithRole(
  database: DatabaseOrTransaction,
  tenantId: string,
  roleHandle: string,
): Promise<Person[]> {
  return database
    .selectDistinct({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(and(eq(usersTable.tenantId, tenantId), eq(rolesTable.handle, roleHandle)))
    .orderBy(asc(usersTable.id));
}

export async function listRoleHandlesForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<string[]> {
  const rows = await database
    .select({ handle: rolesTable.handle })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(eq(userRolesTable.userId, userId));
  return rows.map((row) => row.handle);
}

export async function listRoles(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<{ handle: string; name: string }[]> {
  return database
    .select({ handle: rolesTable.handle, name: rolesTable.name })
    .from(rolesTable)
    .where(eq(rolesTable.tenantId, tenantId))
    .orderBy(asc(rolesTable.name));
}

export async function findPeopleByIds(
  database: DatabaseOrTransaction,
  userIds: string[],
): Promise<Person[]> {
  if (userIds.length === 0) return [];
  return database
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
}
