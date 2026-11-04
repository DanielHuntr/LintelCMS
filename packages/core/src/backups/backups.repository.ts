import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type BackupRow,
  backupsTable as backupsDefinition,
  type NewBackupRow,
} from "./backups.table.js";
import type { BackupTrigger } from "./backups.schema.js";
import { insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for the list of backups, nothing else. */

export async function listBackupRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<BackupRow[]> {
  const backupsTable = tableFor(database, backupsDefinition);
  return database
    .select()
    .from(backupsTable)
    .where(eq(backupsTable.tenantId, tenantId))
    .orderBy(desc(backupsTable.createdAt));
}

export async function findBackupRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  backupId: string,
): Promise<BackupRow | undefined> {
  const backupsTable = tableFor(database, backupsDefinition);
  const [row] = await database
    .select()
    .from(backupsTable)
    .where(and(eq(backupsTable.tenantId, tenantId), eq(backupsTable.id, backupId)))
    .limit(1);
  return row;
}

export async function insertBackupRow(
  database: DatabaseOrTransaction,
  backup: NewBackupRow,
): Promise<BackupRow> {
  const backupsTable = tableFor(database, backupsDefinition);
  const [row] = await insertReturning(database, backupsTable, backup);
  if (!row) {
    throw new Error("The backup could not be recorded.");
  }
  return row;
}

export async function updateBackupRow(
  database: DatabaseOrTransaction,
  backupId: string,
  changes: Partial<Omit<NewBackupRow, "id" | "tenantId">>,
): Promise<void> {
  const backupsTable = tableFor(database, backupsDefinition);
  await database
    .update(backupsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(backupsTable.id, backupId));
}

export async function deleteBackupRow(
  database: DatabaseOrTransaction,
  backupId: string,
): Promise<void> {
  const backupsTable = tableFor(database, backupsDefinition);
  await database.delete(backupsTable).where(eq(backupsTable.id, backupId));
}

/** Complete backups made by one trigger, newest first. */
export async function listCompleteBackupsBy(
  database: DatabaseOrTransaction,
  tenantId: string,
  trigger: BackupTrigger,
): Promise<BackupRow[]> {
  const backupsTable = tableFor(database, backupsDefinition);
  return database
    .select()
    .from(backupsTable)
    .where(
      and(
        eq(backupsTable.tenantId, tenantId),
        eq(backupsTable.trigger, trigger),
        eq(backupsTable.status, "complete"),
      ),
    )
    .orderBy(desc(backupsTable.createdAt));
}

/** Backups left "running" by a server that stopped part way through. */
export async function failRunningBackups(
  database: DatabaseOrTransaction,
  tenantId: string,
  reason: string,
): Promise<void> {
  const backupsTable = tableFor(database, backupsDefinition);
  await database
    .update(backupsTable)
    .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
    .where(and(eq(backupsTable.tenantId, tenantId), eq(backupsTable.status, "running")));
}
