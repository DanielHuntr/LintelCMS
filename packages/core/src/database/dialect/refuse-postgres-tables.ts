import { is } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { PgTable } from "drizzle-orm/pg-core";

/**
 * Drizzle will happily build a MySQL query from a Postgres table, and the query mostly works,
 * reading times and JSON wrongly. So in tests on MySQL, Lintel's own and a plugin's, a query on
 * a table that didn't come through `tableFor` fails at once. A running site doesn't do this.
 */

function refuse(table: unknown): void {
  if (is(table, PgTable)) {
    throw new Error(`A query used a Postgres table on MySQL. Get it through tableFor.`);
  }
}

interface QueryConfig {
  table?: unknown;
  joins?: readonly { table?: unknown }[];
}

let refusing = false;

export function refusePostgresTablesOnMysql(): void {
  if (refusing) return;
  refusing = true;
  const dialect = MySqlDialect.prototype as unknown as Record<
    string,
    (this: unknown, config: QueryConfig) => unknown
  >;
  for (const method of [
    "buildSelectQuery",
    "buildInsertQuery",
    "buildUpdateQuery",
    "buildDeleteQuery",
  ]) {
    const original = dialect[method];
    if (!original) throw new Error(`Drizzle no longer has ${method}.`);
    dialect[method] = function checked(this: unknown, config: QueryConfig) {
      refuse(config.table);
      config.joins?.forEach((join) => refuse(join.table));
      return original.call(this, config);
    };
  }
}
