import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../database/schema.js";

/**
 * Tables a backup leaves out, and why:
 * - `sessions`: who is signed in right now. Restoring them would sign people back in to
 *   browsers they may have left; everyone signs in again instead.
 * - `backups`, `wordpress_imports`, `wordpress_import_items`: the record of backups and
 *   imports made on this install. Restoring an old backup shouldn't make newer backups
 *   disappear from the list, or forget an import half way through.
 * - `settings`: kept in the archive's settings.json instead, so it can be read on its own.
 */
export const TABLES_LEFT_OUT_OF_BACKUPS = [
  "sessions",
  "backups",
  "wordpress_imports",
  "wordpress_import_items",
  "settings",
];

/** Every table in the schema, by name. */
export function listSchemaTables(): PgTable[] {
  const values: unknown[] = Object.values(schema);
  return values.filter((value): value is PgTable => is(value, PgTable));
}

/** The tables a backup holds, ordered so every table comes after the tables it points at. */
export function listBackedUpTables(): PgTable[] {
  const tables = listSchemaTables().filter(
    (table) => !TABLES_LEFT_OUT_OF_BACKUPS.includes(getTableName(table)),
  );
  return orderByForeignKeys(tables);
}

/**
 * Orders tables so a table's rows can be inserted once the rows it references are in.
 * A table pointing at itself (an entry's parent page) doesn't count: one insert statement
 * holds the whole table, and Postgres checks those references at the end of the statement.
 */
export function orderByForeignKeys(tables: readonly PgTable[]): PgTable[] {
  const byName = new Map(tables.map((table) => [getTableName(table), table]));
  const ordered: PgTable[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  const place = (table: PgTable) => {
    const name = getTableName(table);
    if (placed.has(name) || visiting.has(name)) {
      return;
    }
    visiting.add(name);
    for (const referenced of referencedTableNames(table)) {
      const dependency = byName.get(referenced);
      if (dependency && referenced !== name) {
        place(dependency);
      }
    }
    visiting.delete(name);
    placed.add(name);
    ordered.push(table);
  };

  for (const table of tables) {
    place(table);
  }
  return ordered;
}

function referencedTableNames(table: PgTable): string[] {
  return getTableConfig(table).foreignKeys.map((foreignKey) =>
    getTableName(foreignKey.reference().foreignTable),
  );
}

/** The database names of a table's columns, as they are now. */
export function columnNamesOf(table: PgTable): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}
