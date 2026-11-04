import { getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../database/client.js";
import { settingsTable } from "../settings/settings.table.js";
import { columnNamesOf } from "./table-order.js";
import { dialectOf } from "../database/dialect/database-dialect.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { currentSchema, readRawRows, rowsOfResult } from "../database/dialect/raw-queries.js";
import {
  emptyMysqlTables,
  fillInMysqlColumns,
  insertAllMysqlRows,
  readAllMysqlRows,
} from "./mysql-snapshot.repository.js";

/**
 * Whole-table reads and writes for backups, nothing else.
 *
 * On Postgres, rows are read with `row_to_json` and written back with
 * `json_populate_recordset`, so every column type (timestamps, arrays, JSON) goes through
 * Postgres unchanged, on the built-in database and a Postgres server alike, with no
 * per-table code to keep up to date.
 *
 * MySQL has neither, so `mysql-snapshot.repository.ts` reads and writes the same JSON rows. A
 * backup doesn't say which database it came from, so one can be restored into another.
 */

export type TableRow = Record<string, unknown>;

/**
 * A table in Lintel's schema, or one known only by name: an add-on's own table, declared in
 * its manifest (see src/addons/addon-declarations.ts).
 */
export type SnapshotTable = PgTable | string;

function nameOf(table: SnapshotTable): string {
  return typeof table === "string" ? table : getTableName(table);
}

/** The columns a table has: from the schema, or for a named one from the database. */
async function columnsOf(database: DatabaseOrTransaction, table: SnapshotTable) {
  if (typeof table !== "string") return columnNamesOf(table);
  const rows = await readRawRows(
    database,
    sql`select column_name as column_name from information_schema.columns
        where table_schema = ${currentSchema(database)} and table_name = ${table}
        order by ordinal_position`,
  );
  return rows.map((row) => String(row.column_name));
}

/** Those of these tables that are in the database now. */
export async function findExistingTables(
  database: DatabaseOrTransaction,
  names: readonly string[],
): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await readRawRows(
    database,
    sql`select table_name as table_name from information_schema.tables
        where table_schema = ${currentSchema(database)} and table_type = 'BASE TABLE'`,
  );
  const present = new Set(rows.map((row) => String(row.table_name)));
  return names.filter((name) => present.has(name));
}

/** Every row of a table, with database column names as keys. */
export async function readAllRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
): Promise<TableRow[]> {
  if (dialectOf(database) === "mysql") return readAllMysqlRows(database, table);
  const name = sql.identifier(nameOf(table));
  const [first] = await readRawRows(
    database,
    sql`select coalesce(json_agg(row_to_json(t)), '[]'::json) as rows from ${name} as t`,
  );
  const rows = parseJson(first?.rows);
  return Array.isArray(rows) ? (rows as TableRow[]) : [];
}

export async function countRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
): Promise<number> {
  const name = sql.identifier(nameOf(table));
  const [row] = await readRawRows(database, sql`select count(*) as count from ${name}`);
  return Number(row?.count ?? 0);
}

/** Empties these tables, and anything that points at them (such as sessions), in one go. */
export async function emptyTables(
  database: DatabaseOrTransaction,
  tables: readonly SnapshotTable[],
): Promise<void> {
  if (dialectOf(database) === "mysql") {
    await emptyMysqlTables(database, tables.map(nameOf));
    return;
  }
  const names = tables.map((table) => sql.identifier(nameOf(table)));
  await database.execute(sql`truncate table ${sql.join(names, sql`, `)} cascade`);
}

/**
 * Inserts rows read by `readAllRows`. Only columns both the rows and the table have are
 * written, so a backup from before a column was added still goes in, the new column
 * taking its default.
 */
export async function insertAllRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
  rows: readonly TableRow[],
  columnsLeftEmpty: readonly string[] = [],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  for (const column of columnsLeftEmpty) {
    keys.delete(column);
  }
  const columns = (await columnsOf(database, table)).filter((column) => keys.has(column));
  if (dialectOf(database) === "mysql") {
    await insertAllMysqlRows(database, table, rows, columns);
    return;
  }
  const name = sql.identifier(nameOf(table));
  const columnList = sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `,
  );
  await database.execute(
    sql`insert into ${name} (${columnList})
        select ${columnList} from json_populate_recordset(null::${name}, ${JSON.stringify(rows)}::json)`,
  );
}

/**
 * Writes columns `insertAllRows` left empty, matching rows by id. Only columns the rows
 * have are written.
 */
export async function fillInColumns(
  database: DatabaseOrTransaction,
  table: PgTable,
  rows: readonly TableRow[],
  columns: readonly string[],
): Promise<void> {
  const present = columns.filter((column) => rows.some((row) => column in row));
  if (rows.length === 0 || present.length === 0) {
    return;
  }
  if (dialectOf(database) === "mysql") {
    await fillInMysqlColumns(database, table, rows, present);
    return;
  }
  const name = sql.identifier(getTableName(table));
  const assignments = sql.join(
    present.map((column) => sql`${sql.identifier(column)} = source.${sql.identifier(column)}`),
    sql`, `,
  );
  await database.execute(
    sql`update ${name} as target set ${assignments}
        from json_populate_recordset(null::${name}, ${JSON.stringify(rows)}::json) as source
        where target.id = source.id`,
  );
}

export async function readAllSettings(
  database: DatabaseOrTransaction,
): Promise<Record<string, unknown>> {
  const settings = tableFor(database, settingsTable);
  const rows = await database.select({ key: settings.key, value: settings.value }).from(settings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function replaceAllSettings(
  database: DatabaseOrTransaction,
  settings: Record<string, unknown>,
): Promise<void> {
  const table = tableFor(database, settingsTable);
  await database.delete(table);
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    await database.insert(table).values(rows);
  }
}

/** The rows `database.execute` gave back, whichever driver answered. */
export const rowsOf = rowsOfResult;

/**
 * Runs a restore's writes. On Postgres foreign keys are checked at the end of each statement;
 * MySQL checks row by row, so a page before its parent would be refused. Checks are off for
 * this connection only, and the rows are from Lintel's own backup.
 */
export async function withForeignKeysAtEase<T>(
  transaction: DatabaseOrTransaction,
  restore: () => Promise<T>,
): Promise<T> {
  if (dialectOf(transaction) !== "mysql") return restore();
  await transaction.execute(sql`set foreign_key_checks = 0`);
  try {
    return await restore();
  } finally {
    await transaction.execute(sql`set foreign_key_checks = 1`);
  }
}

function parseJson(value: unknown): unknown {
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}
