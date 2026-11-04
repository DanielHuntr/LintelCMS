import { type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/** A row of a raw query, keyed by what the query called each column. */
export type RawRow = Record<string, unknown>;

/**
 * What `database.execute` gave back, as rows. Every driver says it differently: the built-in
 * database answers `{ rows }`, postgres.js the rows themselves, and mysql2 `[rows, fields]`.
 */
export function rowsOfResult(result: unknown): RawRow[] {
  if (Array.isArray(result)) {
    const [first] = result as unknown[];
    return (Array.isArray(first) ? first : result) as RawRow[];
  }
  if (typeof result === "object" && result !== null && "rows" in result) {
    const { rows } = result as { rows: unknown };
    return Array.isArray(rows) ? (rows as RawRow[]) : [];
  }
  return [];
}

/** Runs a raw query and returns its rows, on any database. */
export async function readRawRows(database: DatabaseOrTransaction, query: SQL): Promise<RawRow[]> {
  return rowsOfResult(await database.execute(query));
}

/**
 * Drizzle's own record of applied migrations: in its "drizzle" schema on Postgres, and among
 * the other tables on MySQL, which has no schemas inside a database.
 */
export function appliedMigrationsTable(database: DatabaseOrTransaction): SQL {
  return dialectOf(database) === "postgres"
    ? sql`drizzle.__drizzle_migrations`
    : sql`__drizzle_migrations`;
}

/** The schema Lintel's tables are in. MySQL calls this the database. */
export function currentSchema(database: DatabaseOrTransaction): SQL {
  return dialectOf(database) === "postgres" ? sql`current_schema()` : sql`database()`;
}

/** How much room a table takes on disk, in bytes. */
export async function measureTable(
  database: DatabaseOrTransaction,
  table: string,
): Promise<number> {
  const query =
    dialectOf(database) === "postgres"
      ? sql`select pg_total_relation_size(${table}::regclass)::bigint as bytes`
      : sql`select data_length + index_length as bytes from information_schema.tables
            where table_schema = database() and table_name = ${table}`;
  const [row] = await readRawRows(database, query);
  return Number(row?.bytes ?? 0);
}
