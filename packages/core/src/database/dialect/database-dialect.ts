import { is } from "drizzle-orm";
import { MySqlDatabase } from "drizzle-orm/mysql-core";
import type { DatabaseOrTransaction } from "../client.js";

/**
 * The one place that says which kind of SQL a database speaks and what it can do.
 * "postgres" covers the built-in database (PGlite) and a Postgres server; "mysql" covers
 * MySQL and MariaDB, which share a driver and everything the helpers here rely on.
 */
export type DatabaseDialect = "postgres" | "mysql";

/** What the helpers in this folder need to know. Each entry is read by at least one. */
export interface DatabaseCapabilities {
  /** Whether a write can hand back the rows it wrote. If not, they are read back. */
  writesReturnRows: boolean;
  /** Whether an upsert can name the unique key it means, rather than firing on any. */
  upsertsNameTheirKey: boolean;
  /** Whether an insert's values can read from the table being inserted into. */
  insertsReadTheirOwnTable: boolean;
  /** Whether `textSearch` can tell where a word starts. If not, rows are checked in Node. */
  searchFindsWordStarts: boolean;
  /** Whether `jsonKeyEquals` tells lists apart by order and repeats. If not, check in Node. */
  jsonKeyEqualsIsExact: boolean;
}

const capabilities: Record<DatabaseDialect, DatabaseCapabilities> = {
  postgres: {
    writesReturnRows: true,
    upsertsNameTheirKey: true,
    insertsReadTheirOwnTable: true,
    searchFindsWordStarts: true,
    jsonKeyEqualsIsExact: true,
  },
  // MariaDB has `returning` on inserts and deletes but not updates, and MySQL has none, so
  // both read rows back rather than Lintel keeping a third path.
  mysql: {
    writesReturnRows: false,
    upsertsNameTheirKey: false,
    insertsReadTheirOwnTable: false,
    searchFindsWordStarts: false,
    jsonKeyEqualsIsExact: false,
  },
};

/**
 * Which dialect a database (or a transaction inside one) speaks. Repositories are typed
 * against the Postgres `Database` (see README.md), so this looks at what the object really
 * is rather than at its type.
 */
export function dialectOf(database: DatabaseOrTransaction): DatabaseDialect {
  return is(database, MySqlDatabase) ? "mysql" : "postgres";
}

export function capabilitiesOf(database: DatabaseOrTransaction): DatabaseCapabilities {
  return capabilities[dialectOf(database)];
}
