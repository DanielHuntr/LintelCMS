import { and, eq, inArray } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "./entries.table.js";
import { jsonValue } from "../database/dialect/expressions.js";
import {
  jsonHasKey,
  jsonIsObject,
  jsonLiteral,
  jsonWithKey,
} from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const rows = await database
    .select({
      entryId: entriesTable.id,
      value: jsonValue(database, entriesTable.data, handle),
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(collectionsTable.blueprintId, blueprintId),
        jsonHasKey(database, entriesTable.data, handle),
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
  const entriesTable = tableFor(database, entriesDefinition);
  if (entryIds.length === 0) return;
  const json = jsonLiteral(database, value);
  await database
    .update(entriesTable)
    .set({ data: jsonWithKey(database, entriesTable.data, handle, json) })
    .where(inArray(entriesTable.id, [...entryIds]));
  await database
    .update(entriesTable)
    .set({
      publishedData: jsonWithKey(database, entriesTable.publishedData, handle, json),
    })
    .where(
      and(
        inArray(entriesTable.id, [...entryIds]),
        jsonIsObject(database, entriesTable.publishedData),
        jsonHasKey(database, entriesTable.publishedData, handle),
      ),
    );
}
