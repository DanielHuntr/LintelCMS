import { eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, revisionsTable } from "../entries/entries.table.js";
import { globalValuesTable } from "../globals/globals.table.js";
import { assetsTable } from "../media/media.table.js";
import { webhooksTable } from "../webhooks/webhooks.table.js";

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
  const entries = await database
    .update(entriesTable)
    .set({ createdBy: toUserId })
    .where(eq(entriesTable.createdBy, fromUserId))
    .returning({ id: entriesTable.id });
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
