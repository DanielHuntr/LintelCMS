import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  bridgeReceiptsTable as bridgeReceiptsDefinition,
  type NewPublishTargetRow,
  type PublishRunRow,
  publishRunsTable as publishRunsDefinition,
  type PublishTargetRow,
  publishTargetsTable as publishTargetsDefinition,
} from "./publishing.table.js";
import {
  deleteReturning,
  insertIfNewReturning,
  insertReturning,
  updateReturning,
} from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for publishing targets, their runs and receipts. */

export function listTargetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<PublishTargetRow[]> {
  const publishTargetsTable = tableFor(database, publishTargetsDefinition);
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
  const publishTargetsTable = tableFor(database, publishTargetsDefinition);
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
  const publishTargetsTable = tableFor(database, publishTargetsDefinition);
  const [inserted] = await insertReturning(database, publishTargetsTable, row);
  if (!inserted) throw new Error("Saving the publishing destination returned nothing.");
  return inserted;
}

export async function updateTargetRow(
  database: DatabaseOrTransaction,
  targetId: string,
  changes: Partial<NewPublishTargetRow>,
): Promise<PublishTargetRow | undefined> {
  const publishTargetsTable = tableFor(database, publishTargetsDefinition);
  const [updated] = await updateReturning(
    database,
    publishTargetsTable,
    changes,
    eq(publishTargetsTable.id, targetId),
  );
  return updated;
}

export async function deleteTargetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  targetId: string,
): Promise<boolean> {
  const publishTargetsTable = tableFor(database, publishTargetsDefinition);
  const deleted = await deleteReturning(
    database,
    publishTargetsTable,
    and(eq(publishTargetsTable.tenantId, tenantId), eq(publishTargetsTable.id, targetId)),
    { id: publishTargetsTable.id },
  );
  return deleted.length > 0;
}

export async function insertRunRow(
  database: DatabaseOrTransaction,
  row: typeof publishRunsDefinition.$inferInsert,
): Promise<PublishRunRow> {
  const publishRunsTable = tableFor(database, publishRunsDefinition);
  const [inserted] = await insertReturning(database, publishRunsTable, row);
  if (!inserted) throw new Error("Recording the publish returned nothing.");
  return inserted;
}

export async function updateRunRow(
  database: DatabaseOrTransaction,
  runId: string,
  changes: Partial<typeof publishRunsDefinition.$inferInsert>,
): Promise<void> {
  const publishRunsTable = tableFor(database, publishRunsDefinition);
  await database.update(publishRunsTable).set(changes).where(eq(publishRunsTable.id, runId));
}

export function listRunRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  targetId: string,
  limit: number,
): Promise<PublishRunRow[]> {
  const publishRunsTable = tableFor(database, publishRunsDefinition);
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
  const publishRunsTable = tableFor(database, publishRunsDefinition);
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
  row: typeof bridgeReceiptsDefinition.$inferInsert,
): Promise<boolean> {
  const bridgeReceiptsTable = tableFor(database, bridgeReceiptsDefinition);
  const inserted = await insertIfNewReturning(
    database,
    bridgeReceiptsTable,
    row,
    {},
    { id: bridgeReceiptsTable.id },
  );
  return inserted.length > 0;
}
