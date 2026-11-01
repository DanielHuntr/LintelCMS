import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  deleteRoleLayout,
  deleteUserLayout,
  findRoleLayoutsForUser,
  findUserLayout,
  listRolesWithLayouts,
  roleExists,
  upsertRoleLayout,
  upsertUserLayout,
} from "./dashboard.repository.js";
import { RoleNotFoundError } from "./dashboard.errors.js";
import type {
  DashboardLayoutResponse,
  RoleLayoutsResponse,
  WidgetPlacement,
} from "./dashboard.schema.js";

/**
 * Whose layout someone sees, in order: their own, then their role's default (the first by
 * role name, when several of their roles have one), then none, which the admin fills in
 * with its built-in default. "Reset to default" removes their own, so the next one shows.
 */
export async function findDashboardLayout(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<DashboardLayoutResponse> {
  const own = await findUserLayout(database, DEFAULT_TENANT_ID, userId);
  if (own) {
    return { widgets: own, source: "user" };
  }
  const [fromRole] = await findRoleLayoutsForUser(database, DEFAULT_TENANT_ID, userId);
  if (fromRole) {
    return { widgets: fromRole, source: "role" };
  }
  return { widgets: null, source: "default" };
}

export async function saveDashboardLayout(
  database: DatabaseOrTransaction,
  userId: string,
  widgets: WidgetPlacement[],
): Promise<DashboardLayoutResponse> {
  await upsertUserLayout(database, DEFAULT_TENANT_ID, userId, widgets);
  return { widgets, source: "user" };
}

export async function resetDashboardLayout(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<DashboardLayoutResponse> {
  await deleteUserLayout(database, DEFAULT_TENANT_ID, userId);
  return findDashboardLayout(database, userId);
}

export async function listRoleLayouts(
  database: DatabaseOrTransaction,
): Promise<RoleLayoutsResponse> {
  return { roles: await listRolesWithLayouts(database, DEFAULT_TENANT_ID) };
}

export async function saveRoleLayout(
  database: DatabaseOrTransaction,
  roleId: string,
  widgets: WidgetPlacement[],
): Promise<RoleLayoutsResponse> {
  await requireRole(database, roleId);
  await upsertRoleLayout(database, DEFAULT_TENANT_ID, roleId, widgets);
  return listRoleLayouts(database);
}

export async function clearRoleLayout(
  database: DatabaseOrTransaction,
  roleId: string,
): Promise<RoleLayoutsResponse> {
  await requireRole(database, roleId);
  await deleteRoleLayout(database, DEFAULT_TENANT_ID, roleId);
  return listRoleLayouts(database);
}

async function requireRole(database: DatabaseOrTransaction, roleId: string): Promise<void> {
  if (!(await roleExists(database, DEFAULT_TENANT_ID, roleId))) {
    throw new RoleNotFoundError();
  }
}
