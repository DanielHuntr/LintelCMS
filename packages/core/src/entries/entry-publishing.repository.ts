import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type Entry, entriesTable, type EntryData } from "./entries.table.js";

/** Database reads and writes for scheduled publishing, nothing else. */

/** Ids of scheduled entries whose time has come. */
export async function findDueScheduledEntryIds(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<string[]> {
  const rows = await database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .where(and(eq(entriesTable.status, "scheduled"), lte(entriesTable.scheduledFor, now)))
    .orderBy(asc(entriesTable.scheduledFor));
  return rows.map((row) => row.id);
}

/**
 * Publishes `scheduledData` (the values the entry had when it was scheduled) only if the
 * entry is still scheduled and due, in one statement. When two servers run the scheduler at
 * once, only one of them gets the row back.
 */
export async function publishIfStillDue(
  database: DatabaseOrTransaction,
  entryId: string,
  now: Date,
  scheduledData: EntryData | undefined,
): Promise<Entry | undefined> {
  const [published] = await database
    .update(entriesTable)
    .set({
      status: "published",
      // An entry scheduled without a revision (by an import, say) goes live as saved.
      publishedData: scheduledData ?? sql`${entriesTable.data}`,
      publishedAt: sql`${entriesTable.scheduledFor}`,
      scheduledFor: null,
    })
    .where(
      and(
        eq(entriesTable.id, entryId),
        eq(entriesTable.status, "scheduled"),
        lte(entriesTable.scheduledFor, now),
      ),
    )
    .returning();
  return published;
}
