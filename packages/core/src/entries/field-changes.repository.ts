import { and, eq, inArray, sql } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "./entries.table.js";

/** Database reads and writes for a field whose type or choices changed. See field-changes.service.ts. */

export interface StoredFieldValue {
  entryId: string;
  value: unknown;
}

/** Each entry of the blueprint's collections that holds a value under `handle`, with it. */
export async function listFieldValues(
  database: DatabaseOrTransaction,
  blueprintId: string,
  handle: string,
): Promise<StoredFieldValue[]> {
  const rows = await database
    .select({
      entryId: entriesTable.id,
      value: sql<unknown>`${entriesTable.data} -> ${handle}::text`,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(collectionsTable.blueprintId, blueprintId),
        sql`jsonb_exists(${entriesTable.data}, ${handle}::text)`,
      ),
    );
  return rows;
}

/** Stores a converted value under `handle`, in the saved values and the published ones. */
export async function replaceFieldValue(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
  handle: string,
  value: unknown,
): Promise<void> {
  if (entryIds.length === 0) return;
  const json = JSON.stringify(value);
  await database
    .update(entriesTable)
    .set({ data: sql`jsonb_set(${entriesTable.data}, array[${handle}::text], ${json}::jsonb)` })
    .where(inArray(entriesTable.id, [...entryIds]));
  await database
    .update(entriesTable)
    .set({
      publishedData: sql`jsonb_set(${entriesTable.publishedData}, array[${handle}::text], ${json}::jsonb)`,
    })
    .where(
      and(
        inArray(entriesTable.id, [...entryIds]),
        sql`jsonb_typeof(${entriesTable.publishedData}) = 'object'`,
        sql`jsonb_exists(${entriesTable.publishedData}, ${handle}::text)`,
      ),
    );
}
