import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  entriesTable as entriesDefinition,
  revisionsTable as revisionsDefinition,
} from "./entries.table.js";
import { dialectOf } from "../database/dialect/database-dialect.js";
import {
  jsonHasKey,
  jsonIsObject,
  jsonKeyInQuery,
  jsonWithKey,
  jsonWithKeyRenamed,
} from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

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
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const revisionsTable = tableFor(database, revisionsDefinition);
  const entriesOfBlueprint = database
    .select({ id: entriesTable.id })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(eq(collectionsTable.blueprintId, blueprintId));
  // MySQL can't read a table in a subquery of an update on it, so it gets the ids themselves.
  const entryIds =
    dialectOf(database) === "mysql"
      ? (await entriesOfBlueprint).map((entry) => entry.id)
      : entriesOfBlueprint;

  await database
    .update(entriesTable)
    .set({ data: renamed(database, entriesTable.data, rename) })
    .where(and(inArray(entriesTable.id, entryIds), holds(database, entriesTable.data, rename)));
  await database
    .update(entriesTable)
    .set({ publishedData: renamed(database, entriesTable.publishedData, rename) })
    .where(
      and(inArray(entriesTable.id, entryIds), holds(database, entriesTable.publishedData, rename)),
    );
  await database
    .update(revisionsTable)
    .set({ data: renamed(database, revisionsTable.data, rename) })
    .where(
      and(inArray(revisionsTable.entryId, entryIds), holds(database, revisionsTable.data, rename)),
    );
}

/** The values object holding the field: the whole column, or its group. */
function holder(database: DatabaseOrTransaction, column: AnyPgColumn, rename: FieldRename): SQL {
  return rename.within === undefined
    ? sql`${column}`
    : jsonKeyInQuery(database, column, rename.within);
}

function holds(
  database: DatabaseOrTransaction,
  column: AnyPgColumn,
  rename: FieldRename,
): SQL | undefined {
  const values = holder(database, column, rename);
  return and(jsonIsObject(database, values), jsonHasKey(database, values, rename.from));
}

function renamed(database: DatabaseOrTransaction, column: AnyPgColumn, rename: FieldRename): SQL {
  const values = holder(database, column, rename);
  const moved = jsonWithKeyRenamed(database, values, rename.from, rename.to);
  return rename.within === undefined ? moved : jsonWithKey(database, column, rename.within, moved);
}
