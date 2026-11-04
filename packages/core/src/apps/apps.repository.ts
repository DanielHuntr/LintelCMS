import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import { type AppRow, appsTable as appsDefinition, type NewAppRow } from "./apps.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for apps, nothing else. */

export type AppWithInstaller = AppRow & { installerName: string | null };

export async function listAppRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<AppWithInstaller[]> {
  const appsTable = tableFor(database, appsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const rows = await database
    .select({ app: appsTable, installerName: usersTable.name })
    .from(appsTable)
    .leftJoin(usersTable, eq(usersTable.id, appsTable.installedBy))
    .where(eq(appsTable.tenantId, tenantId))
    .orderBy(desc(appsTable.createdAt));
  return rows.map((row) => ({ ...row.app, installerName: row.installerName }));
}

export async function findAppRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  appId: string,
): Promise<AppWithInstaller | undefined> {
  const appsTable = tableFor(database, appsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const [row] = await database
    .select({ app: appsTable, installerName: usersTable.name })
    .from(appsTable)
    .leftJoin(usersTable, eq(usersTable.id, appsTable.installedBy))
    .where(and(eq(appsTable.tenantId, tenantId), eq(appsTable.id, appId)))
    .limit(1);
  return row && { ...row.app, installerName: row.installerName };
}

export async function findAppRowByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<AppRow | undefined> {
  const appsTable = tableFor(database, appsDefinition);
  const [row] = await database
    .select()
    .from(appsTable)
    .where(and(eq(appsTable.tenantId, tenantId), eq(appsTable.handle, handle)))
    .limit(1);
  return row;
}

export async function findAppRowBySecretHash(
  database: DatabaseOrTransaction,
  secretHash: string,
): Promise<AppRow | undefined> {
  const appsTable = tableFor(database, appsDefinition);
  const [row] = await database
    .select()
    .from(appsTable)
    .where(eq(appsTable.clientSecretHash, secretHash))
    .limit(1);
  return row;
}

export async function insertApp(database: DatabaseOrTransaction, app: NewAppRow): Promise<AppRow> {
  const appsTable = tableFor(database, appsDefinition);
  const [inserted] = await insertReturning(database, appsTable, app);
  if (!inserted) {
    throw new Error("Saving the app returned nothing");
  }
  return inserted;
}

export async function recordAppUse(
  database: DatabaseOrTransaction,
  appId: string,
  usedAt: Date,
): Promise<void> {
  const appsTable = tableFor(database, appsDefinition);
  await database.update(appsTable).set({ lastUsedAt: usedAt }).where(eq(appsTable.id, appId));
}

/** True when the app was there. Its webhooks and their deliveries go with it. */
export async function deleteAppRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  appId: string,
): Promise<boolean> {
  const appsTable = tableFor(database, appsDefinition);
  const deleted = await deleteReturning(
    database,
    appsTable,
    and(eq(appsTable.tenantId, tenantId), eq(appsTable.id, appId)),
    { id: appsTable.id },
  );
  return deleted.length > 0;
}
