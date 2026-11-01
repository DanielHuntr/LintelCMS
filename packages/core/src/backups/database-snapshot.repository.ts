import { getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../database/client.js";
import { settingsTable } from "../settings/settings.table.js";
import { columnNamesOf } from "./table-order.js";

/**
 * Whole-table reads and writes for backups, nothing else.
 *
 * Rows are read with Postgres' own `row_to_json` and written back with
 * `json_populate_recordset`, so every column type (timestamps, arrays, JSON) goes through
 * Postgres unchanged, on the built-in database and a Postgres server alike, with no
 * per-table code to keep up to date.
 */

export type TableRow = Record<string, unknown>;

/** Every row of a table, with database column names as keys. */
export async function readAllRows(
  database: DatabaseOrTransaction,
  table: PgTable,
): Promise<TableRow[]> {
  const name = sql.identifier(getTableName(table));
  const result = await database.execute(
    sql`select coalesce(json_agg(row_to_json(t)), '[]'::json) as rows from ${name} as t`,
  );
  const [first] = rowsOf(result);
  const rows = parseJson(first?.rows);
  return Array.isArray(rows) ? (rows as TableRow[]) : [];
}

export async function countRows(database: DatabaseOrTransaction, table: PgTable): Promise<number> {
  const name = sql.identifier(getTableName(table));
  const result = await database.execute(sql`select count(*)::int as count from ${name}`);
  return Number(rowsOf(result)[0]?.count ?? 0);
}

/** Empties these tables, and anything that points at them (such as sessions), in one go. */
export async function emptyTables(
  database: DatabaseOrTransaction,
  tables: readonly PgTable[],
): Promise<void> {
  const names = tables.map((table) => sql.identifier(getTableName(table)));
  await database.execute(sql`truncate table ${sql.join(names, sql`, `)} cascade`);
}

/**
 * Inserts rows read by `readAllRows`. Only columns both the rows and the table have are
 * written, so a backup from before a column was added still goes in, the new column
 * taking its default.
 */
export async function insertAllRows(
  database: DatabaseOrTransaction,
  table: PgTable,
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
  const columns = columnNamesOf(table).filter((column) => keys.has(column));
  const name = sql.identifier(getTableName(table));
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
  const rows = await database
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function replaceAllSettings(
  database: DatabaseOrTransaction,
  settings: Record<string, unknown>,
): Promise<void> {
  await database.delete(settingsTable);
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  if (rows.length > 0) {
    await database.insert(settingsTable).values(rows);
  }
}

/** The built-in database returns `{ rows }`, the Postgres driver the rows themselves. */
export function rowsOf(result: unknown): TableRow[] {
  if (Array.isArray(result)) {
    return result as TableRow[];
  }
  if (typeof result === "object" && result !== null && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    return Array.isArray(rows) ? (rows as TableRow[]) : [];
  }
  return [];
}

function parseJson(value: unknown): unknown {
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}
