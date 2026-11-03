import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  bridgeReceiptsTable,
  type NewPublishTargetRow,
  type PublishRunRow,
  publishRunsTable,
  type PublishTargetRow,
  publishTargetsTable,
} from "./publishing.table.js";

/** Database reads and writes for publishing targets, their runs and receipts. */

export function listTargetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<PublishTargetRow[]> {
  return database
    .select()
    .from(publishTargetsTable)
    .where(eq(publishTargetsTable.tenantId, tenantId))
    .orderBy(publishTargetsTable.createdAt);
}

export async function findTargetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  targetId: string,
): Promise<PublishTargetRow | undefined> {
  const [row] = await database
    .select()
    .from(publishTargetsTable)
    .where(and(eq(publishTargetsTable.tenantId, tenantId), eq(publishTargetsTable.id, targetId)))
    .limit(1);
  return row;
}

export async function insertTargetRow(
  database: DatabaseOrTransaction,
  row: NewPublishTargetRow,
): Promise<PublishTargetRow> {
  const [inserted] = await database.insert(publishTargetsTable).values(row).returning();
  if (!inserted) throw new Error("Saving the publishing destination returned nothing.");
  return inserted;
}

export async function updateTargetRow(
  database: DatabaseOrTransaction,
  targetId: string,
  changes: Partial<NewPublishTargetRow>,
): Promise<PublishTargetRow | undefined> {
  const [updated] = await database
    .update(publishTargetsTable)
    .set(changes)
    .where(eq(publishTargetsTable.id, targetId))
    .returning();
  return updated;
}

export async function deleteTargetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  targetId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(publishTargetsTable)
    .where(and(eq(publishTargetsTable.tenantId, tenantId), eq(publishTargetsTable.id, targetId)))
    .returning({ id: publishTargetsTable.id });
  return deleted.length > 0;
}

export async function insertRunRow(
  database: DatabaseOrTransaction,
  row: typeof publishRunsTable.$inferInsert,
): Promise<PublishRunRow> {
  const [inserted] = await database.insert(publishRunsTable).values(row).returning();
  if (!inserted) throw new Error("Recording the publish returned nothing.");
  return inserted;
}

export async function updateRunRow(
  database: DatabaseOrTransaction,
  runId: string,
  changes: Partial<typeof publishRunsTable.$inferInsert>,
): Promise<void> {
  await database.update(publishRunsTable).set(changes).where(eq(publishRunsTable.id, runId));
}

export function listRunRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  targetId: string,
  limit: number,
): Promise<PublishRunRow[]> {
  return database
    .select()
    .from(publishRunsTable)
    .where(and(eq(publishRunsTable.tenantId, tenantId), eq(publishRunsTable.targetId, targetId)))
    .orderBy(desc(publishRunsTable.startedAt))
    .limit(limit);
}

export async function findRunRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  runId: string,
): Promise<PublishRunRow | undefined> {
  const [row] = await database
    .select()
    .from(publishRunsTable)
    .where(and(eq(publishRunsTable.tenantId, tenantId), eq(publishRunsTable.id, runId)))
    .limit(1);
  return row;
}

/**
 * Records that an item from the companion was taken in. False when it already was, so
 * the caller skips it.
 */
export async function recordReceipt(
  database: DatabaseOrTransaction,
  row: typeof bridgeReceiptsTable.$inferInsert,
): Promise<boolean> {
  const inserted = await database
    .insert(bridgeReceiptsTable)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: bridgeReceiptsTable.id });
  return inserted.length > 0;
}
