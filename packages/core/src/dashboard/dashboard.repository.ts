import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  rolesTable as rolesDefinition,
  userRolesTable as userRolesDefinition,
} from "../roles/roles.table.js";
import type { WidgetPlacement } from "./dashboard.schema.js";
import { dashboardLayoutsTable as dashboardLayoutsDefinition } from "./dashboard.table.js";
import { upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for dashboard layouts, nothing else. */

export async function findUserLayout(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
): Promise<WidgetPlacement[] | undefined> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  const [row] = await database
    .select({ widgets: dashboardLayoutsTable.widgets })
    .from(dashboardLayoutsTable)
    .where(
      and(eq(dashboardLayoutsTable.tenantId, tenantId), eq(dashboardLayoutsTable.userId, userId)),
    )
    .limit(1);
  return row?.widgets;
}

/**
 * The default layouts of the user's roles, by role name, so someone with two roles that
 * both have one always starts from the same one.
 */
export async function findRoleLayoutsForUser(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
): Promise<WidgetPlacement[][]> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  const rolesTable = tableFor(database, rolesDefinition);
  const userRolesTable = tableFor(database, userRolesDefinition);
  const rows = await database
    .select({ widgets: dashboardLayoutsTable.widgets })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .innerJoin(
      dashboardLayoutsTable,
      and(
        eq(dashboardLayoutsTable.roleId, rolesTable.id),
        eq(dashboardLayoutsTable.tenantId, tenantId),
      ),
    )
    .where(eq(userRolesTable.userId, userId))
    .orderBy(asc(rolesTable.name));
  return rows.map((row) => row.widgets);
}

export async function upsertUserLayout(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
  widgets: WidgetPlacement[],
): Promise<void> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  await upsert(
    database,
    dashboardLayoutsTable,
    { tenantId, userId, widgets },
    {
      target: [dashboardLayoutsTable.tenantId, dashboardLayoutsTable.userId],
      set: { widgets, updatedAt: new Date() },
      // The role column is null here, and nulls never clash.
      otherKeysCannotClash: true,
    },
  );
}

export async function deleteUserLayout(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
): Promise<void> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  await database
    .delete(dashboardLayoutsTable)
    .where(
      and(eq(dashboardLayoutsTable.tenantId, tenantId), eq(dashboardLayoutsTable.userId, userId)),
    );
}

/** Every role, with its default layout if it has one. */
export async function listRolesWithLayouts(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Array<{ id: string; name: string; widgets: WidgetPlacement[] | null }>> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  const rolesTable = tableFor(database, rolesDefinition);
  return database
    .select({ id: rolesTable.id, name: rolesTable.name, widgets: dashboardLayoutsTable.widgets })
    .from(rolesTable)
    .leftJoin(
      dashboardLayoutsTable,
      and(
        eq(dashboardLayoutsTable.roleId, rolesTable.id),
        eq(dashboardLayoutsTable.tenantId, tenantId),
      ),
    )
    .where(eq(rolesTable.tenantId, tenantId))
    .orderBy(asc(rolesTable.name));
}

export async function roleExists(
  database: DatabaseOrTransaction,
  tenantId: string,
  roleId: string,
): Promise<boolean> {
  const rolesTable = tableFor(database, rolesDefinition);
  const [row] = await database
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(and(eq(rolesTable.tenantId, tenantId), eq(rolesTable.id, roleId)))
    .limit(1);
  return row !== undefined;
}

export async function upsertRoleLayout(
  database: DatabaseOrTransaction,
  tenantId: string,
  roleId: string,
  widgets: WidgetPlacement[],
): Promise<void> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  await upsert(
    database,
    dashboardLayoutsTable,
    { tenantId, roleId, widgets },
    {
      target: [dashboardLayoutsTable.tenantId, dashboardLayoutsTable.roleId],
      set: { widgets, updatedAt: new Date() },
      // The user column is null here, and nulls never clash.
      otherKeysCannotClash: true,
    },
  );
}

export async function deleteRoleLayout(
  database: DatabaseOrTransaction,
  tenantId: string,
  roleId: string,
): Promise<void> {
  const dashboardLayoutsTable = tableFor(database, dashboardLayoutsDefinition);
  await database
    .delete(dashboardLayoutsTable)
    .where(
      and(eq(dashboardLayoutsTable.tenantId, tenantId), eq(dashboardLayoutsTable.roleId, roleId)),
    );
}
