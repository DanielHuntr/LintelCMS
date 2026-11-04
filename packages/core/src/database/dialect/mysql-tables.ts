import { createHash, randomUUID } from "node:crypto";
import { SQL, getTableColumns, is, sql } from "drizzle-orm";
import {
  type AnyMySqlColumn,
  type MySqlTable,
  bigint,
  boolean,
  check,
  customType,
  date,
  datetime,
  double,
  float,
  foreignKey,
  index,
  int,
  longtext,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { type AnyPgColumn, type PgTable, getTableConfig } from "drizzle-orm/pg-core";
import type { DatabaseOrTransaction } from "../client.js";
import { dialectOf } from "./database-dialect.js";

/**
 * MySQL and MariaDB tables, worked out from the Postgres tables in the `*.table.ts` files.
 * Those files stay the only description of a table, so nothing here can change a Postgres
 * table, and a new column reaches MySQL with no extra code. A column type or default this
 * file doesn't know stops with an error rather than being guessed at.
 *
 * | Postgres          | MySQL / MariaDB                                               |
 * | ----------------- | ------------------------------------------------------------- |
 * | uuid              | varchar(36); ids are made in Node                             |
 * | text              | longtext (plain text holds 64 KB, Postgres text has no limit) |
 * | text in a key     | varchar(255): MySQL can't index longtext. See `keyTextLength` |
 * | text with choices | varchar(64)                                                   |
 * | integer, bigint   | int, bigint                                                   |
 * | real, double      | float, double                                                 |
 * | boolean           | boolean (tinyint)                                             |
 * | date              | date                                                          |
 * | timestamptz       | datetime(3), always UTC (see `mysql-database.ts`)             |
 * | jsonb, arrays     | json. MariaDB's json is longtext with a validity check        |
 */

/** MySQL refuses identifiers longer than this. */
const LONGEST_MYSQL_NAME = 64;
const DEFAULT_KEY_TEXT_LENGTH = 255;
const CHOICE_TEXT_LENGTH = 64;

/**
 * Parsed here rather than by the driver: connections use `jsonStrings`, so every JSON value
 * arrives as text. That way MySQL (a real json type) and MariaDB (longtext) behave the
 * same, and a stored string such as "123" stays a string.
 */
const jsonColumn = customType<{ data: unknown; driverData: string }>({
  dataType: () => "json",
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => JSON.parse(value) as unknown,
});

/**
 * Checks MySQL won't take, because their columns have `on delete` rules (error 3823).
 * What they guard is enforced on every database by the service that writes the rows.
 */
const CHECKS_LEFT_TO_LINTEL = new Set(["dashboard_layouts_one_owner"]);

const built = new WeakMap<PgTable, MySqlTable>();

/** The table in the dialect `database` speaks. On Postgres, the table it was given. */
export function tableFor<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
): TTable {
  return dialectOf(database) === "mysql" ? mysqlTableFor(table) : table;
}

/**
 * The MySQL table for a Postgres table, built once. It is typed as the Postgres table so
 * repositories are written once: the one deliberate type lie (see README.md).
 */
export function mysqlTableFor<TTable extends PgTable>(table: TTable): TTable {
  let mysql = built.get(table);
  if (!mysql) {
    mysql = buildMysqlTable(table);
    built.set(table, mysql);
  }
  return mysql as unknown as TTable;
}

function buildMysqlTable(table: PgTable): MySqlTable {
  const config = getTableConfig(table);
  const keyColumns = namesOfColumnsInKeys(table);
  const columns = Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([key, column]) => [
      key,
      mysqlColumn(config.name, column, keyColumns.has(column.name)),
    ]),
  );
  // Drizzle calls this only when it's needed, so tables can refer to each other.
  return mysqlTable(config.name, columns as never, (mysqlColumns) =>
    keysOf(table, Object.values(mysqlColumns) as unknown as AnyMySqlColumn[]),
  );
}

type OneOrMoreColumns = [AnyMySqlColumn, ...AnyMySqlColumn[]];

function keysOf(table: PgTable, mysqlColumns: AnyMySqlColumn[]) {
  const config = getTableConfig(table);
  const matching = (from: readonly { name?: string }[], among = mysqlColumns) =>
    from.map((column) => {
      const match = among.find((candidate) => candidate.name === column.name);
      if (!match) throw new Error(`${config.name} has no column "${column.name}".`);
      return match;
    }) as OneOrMoreColumns;

  return [
    ...config.primaryKeys.map((key) => primaryKey({ columns: matching(key.columns) })),
    ...config.indexes.map(({ config: { name, unique, columns } }) =>
      (unique ? uniqueIndex : index)(mysqlName(name ?? `${config.name}_index`)).on(
        ...matching(columns as { name?: string }[]),
      ),
    ),
    ...config.columns
      .filter((column) => column.isUnique)
      .map((column) =>
        uniqueIndex(mysqlName(column.uniqueName ?? `${config.name}_${column.name}_unique`)).on(
          ...matching([column]),
        ),
      ),
    ...config.foreignKeys.map((key) => {
      const { columns, foreignColumns, foreignTable } = key.reference();
      const target = Object.values(
        getTableColumns(mysqlTableFor(foreignTable)),
      ) as unknown as AnyMySqlColumn[];
      const mysqlKey = foreignKey({
        name: mysqlName(key.getName()),
        columns: matching(columns),
        foreignColumns: matching(foreignColumns, target),
      });
      if (key.onDelete) mysqlKey.onDelete(key.onDelete);
      if (key.onUpdate) mysqlKey.onUpdate(key.onUpdate);
      return mysqlKey;
    }),
    ...config.checks
      .filter(({ name }) => !CHECKS_LEFT_TO_LINTEL.has(name))
      .map(({ name, value }) => check(mysqlName(name), value)),
  ];
}

/**
 * Text in a key whose length differs from the default. All the columns of one key must fit
 * in 3,072 bytes, at 4 bytes a character, and a foreign key must match the column it refers
 * to. A column name means the same on every table here.
 */
const KEY_TEXT_LENGTHS: Record<string, number> = {
  tenant_id: 64,
  day: 16,
  // Addresses and passkey ids can be long, and these keys have room.
  from_path: 700,
  credential_id: 700,
};

function keyTextLength(column: string): number {
  return KEY_TEXT_LENGTHS[column] ?? DEFAULT_KEY_TEXT_LENGTH;
}

/** Columns that must be varchar, because a key of some kind uses them. */
function namesOfColumnsInKeys(table: PgTable): Set<string> {
  const config = getTableConfig(table);
  const inKeys: { name?: string }[] = [
    ...config.columns.filter((column) => column.primary || column.isUnique),
    ...config.primaryKeys.flatMap((key) => key.columns),
    ...config.indexes.flatMap((key) => key.config.columns as { name?: string }[]),
    ...config.foreignKeys.flatMap((key) => key.reference().columns),
  ];
  return new Set(inKeys.flatMap((column) => (column.name ? [column.name] : [])));
}

/** Column builders all have these, but Drizzle's types for them differ per column. */
interface ColumnBuilder {
  notNull(): this;
  primaryKey(): this;
  default(value: unknown): this;
  $defaultFn(make: () => unknown): this;
  $onUpdateFn(make: () => unknown): this;
}

function mysqlColumn(tableName: string, column: AnyPgColumn, inKey: boolean): ColumnBuilder {
  let mysql = mysqlColumnOfType(tableName, column, inKey);
  if (column.notNull) mysql = mysql.notNull();
  if (column.primary) mysql = mysql.primaryKey();
  if (column.default !== undefined) mysql = withDefault(mysql, tableName, column, inKey);
  if (column.defaultFn) mysql = mysql.$defaultFn(column.defaultFn);
  if (column.onUpdateFn) mysql = mysql.$onUpdateFn(column.onUpdateFn);
  return mysql;
}

function mysqlColumnOfType(tableName: string, column: AnyPgColumn, inKey: boolean): ColumnBuilder {
  const name = column.name;
  switch (column.columnType) {
    case "PgUUID":
      return varchar(name, { length: 36 }) as unknown as ColumnBuilder;
    case "PgText":
      if (inKey) {
        return varchar(name, { length: keyTextLength(name) }) as unknown as ColumnBuilder;
      }
      return (column.enumValues
        ? varchar(name, { length: CHOICE_TEXT_LENGTH })
        : longtext(name)) as unknown as ColumnBuilder;
    case "PgInteger":
      return int(name) as unknown as ColumnBuilder;
    case "PgBigInt53":
      return bigint(name, { mode: "number" }) as unknown as ColumnBuilder;
    case "PgReal":
      return float(name) as unknown as ColumnBuilder;
    case "PgDoublePrecision":
      return double(name) as unknown as ColumnBuilder;
    case "PgBoolean":
      return boolean(name) as unknown as ColumnBuilder;
    case "PgDateString":
      return date(name, { mode: "string" }) as unknown as ColumnBuilder;
    case "PgTimestamp":
      return datetime(name, { mode: "date", fsp: 3 }) as unknown as ColumnBuilder;
    case "PgJsonb":
    case "PgArray":
      return jsonColumn(name) as unknown as ColumnBuilder;
    default:
      throw new Error(
        `${tableName}.${name} is a ${column.columnType}, which has no MySQL type yet. ` +
          "Add it to mysql-tables.ts.",
      );
  }
}

function withDefault(
  mysql: ColumnBuilder,
  tableName: string,
  column: AnyPgColumn,
  inKey: boolean,
): ColumnBuilder {
  const value: unknown = column.default;
  if (is(value, SQL)) {
    const text = value.queryChunks
      .map((chunk) => (chunk && "value" in chunk ? String(chunk.value) : ""))
      .join("");
    if (text === "gen_random_uuid()") return mysql.$defaultFn(() => randomUUID());
    if (text === "now()") return mysql.default(sql`(current_timestamp(3))`);
    throw new Error(`${tableName}.${column.name} has a default MySQL can't use: ${text}.`);
  }
  if (column.columnType === "PgJsonb" || column.columnType === "PgArray") {
    return mysql.default(defaultExpression(JSON.stringify(value)));
  }
  if (column.columnType === "PgText" && !inKey && !column.enumValues) {
    return mysql.default(defaultExpression(String(value)));
  }
  return mysql.default(value);
}

/** json and longtext columns can only default to an expression in brackets. */
function defaultExpression(text: string): SQL {
  return sql.raw(`('${text.replaceAll("\\", "\\\\").replaceAll("'", "''")}')`);
}

/** The same name when it fits; otherwise cut short, with a hash so it stays unique. */
function mysqlName(name: string): string {
  if (name.length <= LONGEST_MYSQL_NAME) return name;
  const hash = createHash("sha256").update(name).digest("hex").slice(0, 8);
  return `${name.slice(0, LONGEST_MYSQL_NAME - hash.length - 1)}_${hash}`;
}
