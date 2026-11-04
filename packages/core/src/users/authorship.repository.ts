import { eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  entriesTable as entriesDefinition,
  revisionsTable as revisionsDefinition,
} from "../entries/entries.table.js";
import { globalValuesTable as globalValuesDefinition } from "../globals/globals.table.js";
import { assetsTable as assetsDefinition } from "../media/media.table.js";
import { webhooksTable as webhooksDefinition } from "../webhooks/webhooks.table.js";
import { updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Moves everything someone made to another person, before their account is removed, so
 * entries keep an author and "edited by" still names someone who can be asked.
 * Returns how many entries changed hands.
 */
export async function reassignAuthorship(
  database: DatabaseOrTransaction,
  fromUserId: string,
  toUserId: string,
): Promise<number> {
  const assetsTable = tableFor(database, assetsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const globalValuesTable = tableFor(database, globalValuesDefinition);
  const revisionsTable = tableFor(database, revisionsDefinition);
  const webhooksTable = tableFor(database, webhooksDefinition);
  const entries = await updateReturning(
    database,
    entriesTable,
    { createdBy: toUserId },
    eq(entriesTable.createdBy, fromUserId),
    { id: entriesTable.id },
  );
  await database
    .update(entriesTable)
    .set({ updatedBy: toUserId })
    .where(eq(entriesTable.updatedBy, fromUserId));
  await database
    .update(revisionsTable)
    .set({ authorId: toUserId })
    .where(eq(revisionsTable.authorId, fromUserId));
  await database
    .update(globalValuesTable)
    .set({ updatedBy: toUserId })
    .where(eq(globalValuesTable.updatedBy, fromUserId));
  await database
    .update(assetsTable)
    .set({ uploadedBy: toUserId })
    .where(eq(assetsTable.uploadedBy, fromUserId));
  await database
    .update(webhooksTable)
    .set({ createdBy: toUserId })
    .where(eq(webhooksTable.createdBy, fromUserId));
  return entries.length;
}
