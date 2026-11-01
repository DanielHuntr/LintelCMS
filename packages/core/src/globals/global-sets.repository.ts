import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type GlobalSet, globalSetsTable, type NewGlobalSet } from "./globals.table.js";

/** Database reads and writes for global sets, nothing else. Values are in global-values. */

export async function listGlobalSetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<GlobalSet[]> {
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
  const [inserted] = await database
    .insert(globalSetsTable)
    .values(globalSet)
    .onConflictDoNothing({ target: [globalSetsTable.tenantId, globalSetsTable.handle] })
    .returning();
  return inserted;
}

export async function updateGlobalSetRow(
  database: DatabaseOrTransaction,
  globalSetId: string,
  changes: Pick<GlobalSet, "name" | "fields">,
): Promise<void> {
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
  await database.delete(globalSetsTable).where(eq(globalSetsTable.id, globalSetId));
}
