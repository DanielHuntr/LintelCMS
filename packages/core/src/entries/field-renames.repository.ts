import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable, revisionsTable } from "./entries.table.js";

/** Database writes for a renamed field, nothing else. See field-renames.service.ts. */

/** A field whose handle changed: `from` to `to`, inside the group `within` if there is one. */
export interface FieldRename {
  from: string;
  to: string;
  /** The handle of the group holding the field's values, such as an imported fieldset. */
  within?: string;
}

/**
 * Moves the values saved under `from` to `to` in every entry of the blueprint's collections:
 * the saved values, the published ones, and every revision, so History restores them too.
 */
export async function moveFieldValues(
  database: DatabaseOrTransaction,
  blueprintId: string,
  rename: FieldRename,
): Promise<void> {
  const entryIds = database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(eq(collectionsTable.blueprintId, blueprintId));

  await database
    .update(entriesTable)
    .set({ data: renamed(entriesTable.data, rename) })
    .where(and(inArray(entriesTable.id, entryIds), holds(entriesTable.data, rename)));
  await database
    .update(entriesTable)
    .set({ publishedData: renamed(entriesTable.publishedData, rename) })
    .where(and(inArray(entriesTable.id, entryIds), holds(entriesTable.publishedData, rename)));
  await database
    .update(revisionsTable)
    .set({ data: renamed(revisionsTable.data, rename) })
    .where(and(inArray(revisionsTable.entryId, entryIds), holds(revisionsTable.data, rename)));
}

/** The values object holding the field: the whole column, or its group. */
function holder(column: AnyPgColumn, rename: FieldRename): SQL {
  return rename.within === undefined ? sql`${column}` : sql`(${column} -> ${rename.within}::text)`;
}

function holds(column: AnyPgColumn, rename: FieldRename): SQL {
  const values = holder(column, rename);
  return sql`jsonb_typeof(${values}) = 'object' and jsonb_exists(${values}, ${rename.from}::text)`;
}

function renamed(column: AnyPgColumn, rename: FieldRename): SQL {
  const values = holder(column, rename);
  const moved = sql`(${values} - ${rename.from}::text) || jsonb_build_object(${rename.to}::text, ${values} -> ${rename.from}::text)`;
  return rename.within === undefined
    ? moved
    : sql`jsonb_set(${column}, array[${rename.within}::text], ${moved})`;
}
