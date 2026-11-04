import { eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../database/client.js";
import { mysqlTableFor } from "../database/dialect/mysql-tables.js";
import { type RawRow, readRawRows } from "../database/dialect/raw-queries.js";
import { referencingTableNames } from "./table-order.js";

/**
 * Whole-table reads and writes for backups on MySQL and MariaDB, nothing else. Rows are the
 * same JSON Postgres writes: database column names as keys, times as ISO text, lists and JSON
 * as they are. `row_to_json` writes times with an offset and this writes them with a Z. Both
 * are the same moment, and both databases read both.
 */

/** Rows in one insert. Big enough to be quick, and well inside MySQL's packet limit. */
const ROWS_PER_INSERT = 100;

type SnapshotTable = PgTable | string;

function archiveValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

/** A table's columns by their database names, with the names rows use in queries. */
function columnsByName(table: PgTable) {
  return new Map(
    Object.entries(getTableColumns(mysqlTableFor(table))).map(([key, column]) => [
      column.name,
      { key, column },
    ]),
  );
}

export async function readAllMysqlRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
): Promise<RawRow[]> {
  if (typeof table === "string") {
    return readRawRows(database, sql`select * from ${sql.identifier(table)}`);
  }
  const columns = [...columnsByName(table)];
  const rows = await database.select().from(mysqlTableFor(table));
  return rows.map((row) =>
    Object.fromEntries(
      columns.map(([name, { key }]) => [name, archiveValue((row as RawRow)[key])]),
    ),
  );
}

/**
 * Empties these tables, and, as `truncate ... cascade` does, every table of Lintel's that
 * points at them. Foreign keys must be at ease (`withForeignKeysAtEase`): rows can't be taken
 * out in any order that suits a table pointing at itself.
 */
export async function emptyMysqlTables(
  database: DatabaseOrTransaction,
  names: readonly string[],
): Promise<void> {
  for (const name of referencingTableNames(names)) {
    await database.execute(sql`delete from ${sql.identifier(name)}`);
  }
}

/** A value from a backup, as a column of this kind wants it. */
function columnValue(column: { dataType: string; columnType: string }, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  return column.columnType === "MySqlDateTime" ? new Date(String(value)) : value;
}

function chunksOf<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += ROWS_PER_INSERT) {
    chunks.push(items.slice(start, start + ROWS_PER_INSERT));
  }
  return chunks;
}

/** A value for a raw insert: mysql2 can't take a list or an object as one value. */
function rawValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  // MySQL's datetime has no zone, and a raw value doesn't go through a column.
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) {
    const moment = new Date(value);
    if (!Number.isNaN(moment.getTime())) {
      return moment.toISOString().replace("T", " ").replace("Z", "");
    }
  }
  return value;
}

async function insertNamedTableRows(
  database: DatabaseOrTransaction,
  table: string,
  rows: readonly RawRow[],
  names: readonly string[],
): Promise<void> {
  const columnList = sql.join(
    names.map((name) => sql.identifier(name)),
    sql`, `,
  );
  for (const chunk of chunksOf(rows)) {
    const values = chunk.map(
      (row) =>
        sql`(${sql.join(
          names.map((name) => sql`${rawValue(row[name] ?? null)}`),
          sql`, `,
        )})`,
    );
    await database.execute(
      sql`insert into ${sql.identifier(table)} (${columnList}) values ${sql.join(values, sql`, `)}`,
    );
  }
}

export async function insertAllMysqlRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
  rows: readonly RawRow[],
  names: readonly string[],
): Promise<void> {
  if (typeof table === "string") {
    await insertNamedTableRows(database, table, rows, names);
    return;
  }
  const columns = columnsByName(table);
  const values = rows.map((row) =>
    Object.fromEntries(
      names.flatMap((name) => {
        const found = columns.get(name);
        return found && name in row ? [[found.key, columnValue(found.column, row[name])]] : [];
      }),
    ),
  );
  for (const chunk of chunksOf(values)) {
    await database.insert(mysqlTableFor(table)).values(chunk as never);
  }
}

/** Writes columns left empty at first, one row at a time, as MySQL can't join to JSON here. */
export async function fillInMysqlColumns(
  database: DatabaseOrTransaction,
  table: PgTable,
  rows: readonly RawRow[],
  names: readonly string[],
): Promise<void> {
  const mysqlTable = mysqlTableFor(table);
  const columns = columnsByName(table);
  const id = columns.get("id")?.column;
  if (!id) throw new Error(`${getTableName(table)} has no id column.`);
  for (const row of rows) {
    const changes = Object.fromEntries(
      names.flatMap((name) => {
        const found = columns.get(name);
        return found && name in row ? [[found.key, columnValue(found.column, row[name])]] : [];
      }),
    );
    if (Object.keys(changes).length > 0) {
      await database
        .update(mysqlTable)
        .set(changes as never)
        .where(eq(id, row.id));
    }
  }
}
