import { type InferSelectModel, type SQL, and, eq, getTableColumns, or } from "drizzle-orm";
import { type MySqlTable, getTableConfig } from "drizzle-orm/mysql-core";
import type {
  PgColumn,
  PgInsertValue,
  PgTable,
  PgUpdateSetSource,
  SelectedFieldsFlat,
} from "drizzle-orm/pg-core";
import type { SelectResultFields } from "drizzle-orm/query-builders/select.types";
import type { DatabaseOrTransaction } from "../client.js";
import { capabilitiesOf } from "./database-dialect.js";
import { isUniqueViolation, uniqueKeyInViolation } from "./database-errors.js";

/**
 * The writes that differ between databases. Each takes the pieces of the Drizzle chain it
 * replaces and returns the same thing, so moving a query here is mechanical:
 *
 *   database.insert(table).values(row).returning()  ->  insertReturning(database, table, row)
 *
 * On Postgres each is exactly that chain. MySQL has no `returning`, so rows are read back
 * by primary key inside a transaction (ids are made in Node, so they are known up front).
 * Pass the table from `tableFor`.
 */

type RowsOf<TTable extends PgTable> = InferSelectModel<TTable>[];
type ValuesOf<TTable extends PgTable> = PgInsertValue<TTable> | PgInsertValue<TTable>[];
type Row = Record<string, unknown>;

/** Inserts rows and returns them as stored, in the order given. */
export async function insertReturning<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
): Promise<RowsOf<TTable>>;
export async function insertReturning<TTable extends PgTable, TFields extends SelectedFieldsFlat>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
  fields: TFields,
): Promise<SelectResultFields<TFields>[]>;
export async function insertReturning(
  database: DatabaseOrTransaction,
  table: PgTable,
  values: ValuesOf<PgTable>,
  fields?: SelectedFieldsFlat,
): Promise<unknown[]> {
  if (capabilitiesOf(database).writesReturnRows) {
    const insert = database.insert(table).values(values as PgInsertValue<PgTable>);
    return fields ? insert.returning(fields) : insert.returning();
  }
  const rows = listOf(values).map((row) => withPrimaryKey(table, row));
  return database.transaction(async (transaction) => {
    await transaction.insert(table).values(rows as PgInsertValue<PgTable>[]);
    return readBack(transaction, table, rows, fields);
  });
}

/** Changes the rows `where` matches and returns them as they are afterwards. */
export async function updateReturning<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  changes: PgUpdateSetSource<TTable>,
  where: SQL | undefined,
): Promise<RowsOf<TTable>>;
export async function updateReturning<TTable extends PgTable, TFields extends SelectedFieldsFlat>(
  database: DatabaseOrTransaction,
  table: TTable,
  changes: PgUpdateSetSource<TTable>,
  where: SQL | undefined,
  fields: TFields,
): Promise<SelectResultFields<TFields>[]>;
export async function updateReturning(
  database: DatabaseOrTransaction,
  table: PgTable,
  changes: PgUpdateSetSource<PgTable>,
  where: SQL | undefined,
  fields?: SelectedFieldsFlat,
): Promise<unknown[]> {
  if (capabilitiesOf(database).writesReturnRows) {
    const update = database.update(table).set(changes).where(where);
    return fields ? update.returning(fields) : update.returning();
  }
  return database.transaction(async (transaction) => {
    // Found first: the change itself may stop the rows matching `where`.
    const keys = await lockKeysOfRows(transaction, table, where);
    if (keys.length === 0) return [];
    await transaction.update(table).set(changes).where(whereRowsAre(table, keys));
    return readBack(transaction, table, keys, fields);
  });
}

/** Deletes the rows `where` matches and returns them as they were. */
export async function deleteReturning<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  where: SQL | undefined,
): Promise<RowsOf<TTable>>;
export async function deleteReturning<TTable extends PgTable, TFields extends SelectedFieldsFlat>(
  database: DatabaseOrTransaction,
  table: TTable,
  where: SQL | undefined,
  fields: TFields,
): Promise<SelectResultFields<TFields>[]>;
export async function deleteReturning(
  database: DatabaseOrTransaction,
  table: PgTable,
  where: SQL | undefined,
  fields?: SelectedFieldsFlat,
): Promise<unknown[]> {
  if (capabilitiesOf(database).writesReturnRows) {
    const remove = database.delete(table).where(where);
    return fields ? remove.returning(fields) : remove.returning();
  }
  return database.transaction(async (transaction) => {
    const keys = await lockKeysOfRows(transaction, table, where);
    if (keys.length === 0) return [];
    const rows = await readBack(transaction, table, keys, fields);
    await transaction.delete(table).where(whereRowsAre(table, keys));
    return rows;
  });
}

type ConflictTarget = PgColumn | PgColumn[];

interface UpsertOptions<TTable extends PgTable> {
  /** The unique key that decides whether the row exists. */
  target: ConflictTarget;
  set: PgUpdateSetSource<TTable>;
  /**
   * For a table with other unique keys this write can never clash with, such as one whose
   * columns are null here. MySQL can't name a key: a clash on any of them fires the update.
   */
  otherKeysCannotClash?: boolean;
}

interface MysqlUpsert {
  onDuplicateKeyUpdate(config: { set: unknown }): Promise<unknown>;
}

/** Inserts a row, or changes the one already there. */
export async function upsert<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
  { target, set, otherKeysCannotClash = false }: UpsertOptions<TTable>,
): Promise<void> {
  const insert = database.insert(table).values(values as never);
  if (capabilitiesOf(database).upsertsNameTheirKey) {
    await insert.onConflictDoUpdate({ target, set: set as PgUpdateSetSource<PgTable> });
    return;
  }
  if (!otherKeysCannotClash) failIfAnotherKeyCouldClash(table, target);
  await (insert as unknown as MysqlUpsert).onDuplicateKeyUpdate({ set });
}

interface InsertIfNewOptions {
  /** Only a clash on this unique key skips the row. Without it, any unique key does. */
  target?: ConflictTarget;
}

/** Inserts rows, skipping any that already exist. */
export async function insertIfNew<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
  options: InsertIfNewOptions = {},
): Promise<void> {
  if (capabilitiesOf(database).writesReturnRows) {
    await database
      .insert(table)
      .values(values as never)
      .onConflictDoNothing(options);
    return;
  }
  await insertEachIfNew(database, table, listOf(values), options);
}

/** Like `insertIfNew`, returning only the rows that were really added. */
export async function insertIfNewReturning<TTable extends PgTable>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
  options?: InsertIfNewOptions,
): Promise<RowsOf<TTable>>;
export async function insertIfNewReturning<
  TTable extends PgTable,
  TFields extends SelectedFieldsFlat,
>(
  database: DatabaseOrTransaction,
  table: TTable,
  values: ValuesOf<TTable>,
  options: InsertIfNewOptions,
  fields: TFields,
): Promise<SelectResultFields<TFields>[]>;
export async function insertIfNewReturning(
  database: DatabaseOrTransaction,
  table: PgTable,
  values: ValuesOf<PgTable>,
  options: InsertIfNewOptions = {},
  fields?: SelectedFieldsFlat,
): Promise<unknown[]> {
  if (capabilitiesOf(database).writesReturnRows) {
    const insert = database
      .insert(table)
      .values(values as PgInsertValue<PgTable>)
      .onConflictDoNothing(options);
    return fields ? insert.returning(fields) : insert.returning();
  }
  return database.transaction(async (transaction) => {
    const added = await insertEachIfNew(transaction, table, listOf(values), options);
    return readBack(transaction, table, added, fields);
  });
}

/**
 * Row by row, catching the clash. `insert ignore` would be shorter, but it also hides
 * foreign key and length errors, and clashes on a different key from the one named. After
 * a duplicate key error MySQL undoes that one statement, so a transaction carries on.
 */
async function insertEachIfNew(
  database: DatabaseOrTransaction,
  table: PgTable,
  rows: readonly Row[],
  { target }: InsertIfNewOptions,
): Promise<Row[]> {
  const added: Row[] = [];
  for (const row of rows) {
    const complete = withPrimaryKey(table, row);
    try {
      await database.insert(table).values(complete as PgInsertValue<PgTable>);
      added.push(complete);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (target && !isKeyNamed(table, target, uniqueKeyInViolation(error))) throw error;
    }
  }
  return added;
}

function listOf(values: unknown): Row[] {
  return (Array.isArray(values) ? values : [values]) as Row[];
}

interface KeyColumn {
  key: string;
  column: PgColumn;
}

function mysqlConfigOf(table: PgTable) {
  return getTableConfig(table as unknown as MySqlTable);
}

/** The table's primary key, with the property names rows use. */
function primaryKeyOf(table: PgTable): KeyColumn[] {
  const compositeKeys = mysqlConfigOf(table).primaryKeys;
  const inCompositeKey = new Set(
    compositeKeys.flatMap((key) => key.columns.map((column) => column.name)),
  );
  return Object.entries(getTableColumns(table))
    .filter(([, column]) => column.primary || inCompositeKey.has(column.name))
    .map(([key, column]) => ({ key, column }));
}

/** Fills in a primary key the database would otherwise make, so the row can be found. */
function withPrimaryKey(table: PgTable, row: Row): Row {
  const complete = { ...row };
  for (const { key, column } of primaryKeyOf(table)) {
    if (complete[key] === undefined && column.defaultFn) {
      complete[key] = column.defaultFn();
    }
  }
  return complete;
}

function whereRowIs(keyColumns: readonly KeyColumn[], row: Row): SQL | undefined {
  return and(...keyColumns.map(({ key, column }) => eq(column, row[key])));
}

function whereRowsAre(table: PgTable, rows: readonly Row[]): SQL | undefined {
  const keyColumns = primaryKeyOf(table);
  return or(...rows.map((row) => whereRowIs(keyColumns, row)));
}

/** Finds the rows `where` matches and locks them until the transaction ends. */
async function lockKeysOfRows(
  transaction: DatabaseOrTransaction,
  table: PgTable,
  where: SQL | undefined,
): Promise<Row[]> {
  const fields = Object.fromEntries(primaryKeyOf(table).map(({ key, column }) => [key, column]));
  return transaction.select(fields).from(table).where(where).for("update");
}

async function readBack(
  transaction: DatabaseOrTransaction,
  table: PgTable,
  rows: readonly Row[],
  fields: SelectedFieldsFlat | undefined,
): Promise<unknown[]> {
  const keyColumns = primaryKeyOf(table);
  const found: unknown[] = [];
  for (const row of rows) {
    const where = whereRowIs(keyColumns, row);
    const query = fields ? transaction.select(fields) : transaction.select();
    found.push(...(await query.from(table).where(where)));
  }
  return found;
}

/** Every unique key on the table apart from the primary key, as column names. */
function uniqueKeysOf(table: PgTable): { name: string; columns: string[] }[] {
  return mysqlConfigOf(table)
    .indexes.filter((index) => index.config.unique)
    .map((index) => ({
      name: index.config.name,
      columns: index.config.columns.map((column) => (column as { name: string }).name),
    }));
}

function sameColumns(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((name) => second.includes(name));
}

function columnNames(target: ConflictTarget): string[] {
  return (Array.isArray(target) ? target : [target]).map((column) => column.name);
}

function isKeyNamed(table: PgTable, target: ConflictTarget, keyName: string | undefined): boolean {
  const names = columnNames(target);
  if (keyName === "PRIMARY") {
    const primary = primaryKeyOf(table).map(({ column }) => column.name);
    return sameColumns(names, primary);
  }
  return uniqueKeysOf(table).some((key) => key.name === keyName && sameColumns(key.columns, names));
}

/** MySQL's upsert fires on any unique key, so a second key could change the wrong row. */
function failIfAnotherKeyCouldClash(table: PgTable, target: ConflictTarget): void {
  const names = columnNames(target);
  const other = uniqueKeysOf(table).find((key) => !sameColumns(key.columns, names));
  if (other) {
    throw new Error(
      `An upsert on ${names.join(", ")} could also fire on ${other.name}. ` +
        "Say otherKeysCannotClash if it never can, or find the row first.",
    );
  }
}
