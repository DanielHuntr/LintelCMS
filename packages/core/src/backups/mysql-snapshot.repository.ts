import { eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../database/client.js";
import { mysqlTableFor } from "../database/dialect/mysql-tables.js";
import { type RawRow, currentSchema, readRawRows } from "../database/dialect/raw-queries.js";
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

type NamedColumnKind = "bytes" | "boolean" | "json" | "time" | "other";

/**
 * MariaDB's json is longtext with a check, so its columns are found by their checks, which it
 * names after the column. MySQL's own json has a type of its own, and MySQL's list of checks
 * has no table names.
 */
async function mariadbJsonColumns(
  database: DatabaseOrTransaction,
  table: string,
): Promise<Set<string>> {
  const [server] = await readRawRows(database, sql`select version() as version`);
  if (!/mariadb/i.test(String(server?.version))) return new Set();
  const rows = await readRawRows(
    database,
    sql`select constraint_name as name, check_clause as clause
        from information_schema.check_constraints
        where constraint_schema = ${currentSchema(database)} and table_name = ${table}`,
  );
  return new Set(
    rows.filter((row) => /^json_valid\(/i.test(String(row.clause))).map((row) => String(row.name)),
  );
}

/** What each column of an add-on's table holds. Only its name is known, so this asks. */
async function columnKindsOf(
  database: DatabaseOrTransaction,
  table: string,
): Promise<Map<string, NamedColumnKind>> {
  const jsonOnMariadb = await mariadbJsonColumns(database, table);
  const rows = await readRawRows(
    database,
    sql`select column_name as name, data_type as type, column_type as full_type
        from information_schema.columns
        where table_schema = ${currentSchema(database)} and table_name = ${table}`,
  );
  const kindOf = ({ name, type, full_type: fullType }: RawRow): NamedColumnKind => {
    if (/blob|binary/i.test(String(type))) return "bytes";
    if (String(fullType).toLowerCase() === "tinyint(1)") return "boolean";
    if (/^(datetime|timestamp)$/i.test(String(type))) return "time";
    return String(type).toLowerCase() === "json" || jsonOnMariadb.has(String(name))
      ? "json"
      : "other";
  };
  return new Map(rows.map((row) => [String(row.name), kindOf(row)]));
}

/** Rows as `row_to_json` writes them: bytes as `\\x` and hex, as bytea's text form is. */
function archiveNamedValue(kind: NamedColumnKind | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Uint8Array) return `\\x${Buffer.from(value).toString("hex")}`;
  if (kind === "boolean") return Boolean(value);
  // Drizzle's driver hands raw times over as text, and they're always UTC.
  if (kind === "time" && typeof value === "string") {
    return new Date(`${value.replace(" ", "T")}Z`).toISOString();
  }
  if (kind === "json" && typeof value === "string") return JSON.parse(value) as unknown;
  return archiveValue(value);
}

async function readAllNamedRows(database: DatabaseOrTransaction, table: string): Promise<RawRow[]> {
  const kinds = await columnKindsOf(database, table);
  const rows = await readRawRows(database, sql`select * from ${sql.identifier(table)}`);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([name, value]) => [name, archiveNamedValue(kinds.get(name), value)]),
    ),
  );
}

export async function readAllMysqlRows(
  database: DatabaseOrTransaction,
  table: SnapshotTable,
): Promise<RawRow[]> {
  if (typeof table === "string") return readAllNamedRows(database, table);
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
 * points at them. Rows can't be taken out in any order that suits a table pointing at itself,
 * so foreign key checks are off meanwhile, and left as they were found: a restore has its own.
 */
export async function emptyMysqlTables(
  database: DatabaseOrTransaction,
  names: readonly string[],
): Promise<void> {
  await database.transaction(async (transaction) => {
    const [checks] = await readRawRows(
      transaction,
      sql`select @@foreign_key_checks as foreign_key_checks`,
    );
    await transaction.execute(sql`set foreign_key_checks = 0`);
    try {
      for (const name of referencingTableNames(names)) {
        await transaction.execute(sql`delete from ${sql.identifier(name)}`);
      }
    } finally {
      await transaction.execute(
        sql`set foreign_key_checks = ${Number(checks?.foreign_key_checks)}`,
      );
    }
  });
}

/** Bytes as a backup holds them: `\\x` and hex. */
function bytesFromArchive(value: unknown): unknown {
  return typeof value === "string" && value.startsWith("\\x")
    ? Buffer.from(value.slice(2), "hex")
    : value;
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
function rawValue(kind: NamedColumnKind | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (kind === "bytes") return bytesFromArchive(value);
  // MySQL's datetime has no zone, and a raw value doesn't go through a column.
  if (kind === "time") {
    return new Date(String(value)).toISOString().replace("T", " ").replace("Z", "");
  }
  if (kind === "json") return JSON.stringify(value);
  return typeof value === "object" ? JSON.stringify(value) : value;
}

async function insertNamedTableRows(
  database: DatabaseOrTransaction,
  table: string,
  rows: readonly RawRow[],
  names: readonly string[],
): Promise<void> {
  const kinds = await columnKindsOf(database, table);
  const columnList = sql.join(
    names.map((name) => sql.identifier(name)),
    sql`, `,
  );
  for (const chunk of chunksOf(rows)) {
    const values = chunk.map(
      (row) =>
        sql`(${sql.join(
          names.map((name) => sql`${rawValue(kinds.get(name), row[name])}`),
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
  // Named here, or `.set` would stamp them as an edit: this is a row put back, not a change.
  const unchanged = Object.fromEntries(
    Object.entries(getTableColumns(mysqlTable))
      .filter(([, column]) => column.onUpdateFn)
      .map(([key, column]) => [key, sql`${column}`]),
  );
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
        .set({ ...changes, ...unchanged } as never)
        .where(eq(id, row.id));
    }
  }
}
