import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type GlobalSet,
  globalSetsTable as globalSetsDefinition,
  type NewGlobalSet,
} from "./globals.table.js";
import { insertIfNewReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for global sets, nothing else. Values are in global-values. */

export async function listGlobalSetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<GlobalSet[]> {
  const globalSetsTable = tableFor(database, globalSetsDefinition);
  return database
    .select()
    .from(globalSetsTable)
    .where(eq(globalSetsTable.tenantId, tenantId))
    .orderBy(asc(globalSetsTable.name));
}

export async function findGlobalSetByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<GlobalSet | undefined> {
  const globalSetsTable = tableFor(database, globalSetsDefinition);
  const [globalSet] = await database
    .select()
    .from(globalSetsTable)
    .where(and(eq(globalSetsTable.tenantId, tenantId), eq(globalSetsTable.handle, handle)))
    .limit(1);
  return globalSet;
}

/** Inserts the set unless one with its handle exists; returns undefined if it did. */
export async function insertGlobalSetIfMissing(
  database: DatabaseOrTransaction,
  globalSet: NewGlobalSet,
): Promise<GlobalSet | undefined> {
  const globalSetsTable = tableFor(database, globalSetsDefinition);
  const [inserted] = await insertIfNewReturning(database, globalSetsTable, globalSet, {
    target: [globalSetsTable.tenantId, globalSetsTable.handle],
  });
  return inserted;
}

export async function updateGlobalSetRow(
  database: DatabaseOrTransaction,
  globalSetId: string,
  changes: Pick<GlobalSet, "name" | "fields">,
): Promise<void> {
  const globalSetsTable = tableFor(database, globalSetsDefinition);
  await database
    .update(globalSetsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(globalSetsTable.id, globalSetId));
}

/** Its values go with it (the foreign key cascades). */
export async function deleteGlobalSetRow(
  database: DatabaseOrTransaction,
  globalSetId: string,
): Promise<void> {
  const globalSetsTable = tableFor(database, globalSetsDefinition);
  await database.delete(globalSetsTable).where(eq(globalSetsTable.id, globalSetId));
}
