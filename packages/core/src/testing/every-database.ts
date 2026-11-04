import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import type { Database } from "../database/client.js";
import { openMysqlDatabase } from "../database/dialect/mysql-database.js";
import * as schema from "../database/schema.js";
import { emptyAllTables, openTestDatabase } from "./test-database.js";

/**
 * For `*.dialects.test.ts` files: runs the same tests on every database within reach. The
 * built-in database always runs, so ordinary `pnpm test` covers the Postgres side of each
 * helper with nothing to install. MySQL and MariaDB run when `TEST_MYSQL_URL` and
 * `TEST_MARIADB_URL` name a server, which `pnpm test:dialects` does in Docker.
 *
 * Their databases are emptied before every test, so never point these at real data.
 */

export type DatabaseUnderTest = "built-in" | "mysql" | "mariadb";

interface OpenTestDatabase {
  database: Database;
  applyMigrations: () => Promise<void>;
  emptyTables: () => Promise<void>;
  close: () => Promise<void>;
}

interface Target {
  name: DatabaseUnderTest;
  open: () => Promise<OpenTestDatabase>;
}

function tableNames() {
  return Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => sql.identifier(getTableName(table)));
}

async function emptyMysqlTables(database: Database): Promise<void> {
  // Foreign keys are off for this connection only, so the order doesn't matter.
  await database.transaction(async (transaction) => {
    await transaction.execute(sql`set foreign_key_checks = 0`);
    for (const name of tableNames()) {
      await transaction.execute(sql`delete from ${name}`);
    }
    await transaction.execute(sql`set foreign_key_checks = 1`);
  });
}

function mysqlTarget(name: DatabaseUnderTest, url: string): Target {
  return {
    name,
    open: async () => {
      const opened = await openMysqlDatabase(url);
      return { ...opened, emptyTables: () => emptyMysqlTables(opened.database) };
    },
  };
}

function targets(): Target[] {
  const mysqlUrl = process.env.TEST_MYSQL_URL;
  const mariadbUrl = process.env.TEST_MARIADB_URL;
  return [
    {
      name: "built-in",
      open: async () => {
        const opened = await openTestDatabase();
        return { ...opened, emptyTables: () => emptyAllTables(opened.database) };
      },
    },
    ...(mysqlUrl ? [mysqlTarget("mysql", mysqlUrl)] : []),
    ...(mariadbUrl ? [mysqlTarget("mariadb", mariadbUrl)] : []),
  ];
}

export interface EveryDatabaseHandle {
  /** Read inside tests and hooks. */
  readonly database: Database;
  readonly name: DatabaseUnderTest;
}

export function describeOnEveryDatabase(
  feature: string,
  tests: (handle: EveryDatabaseHandle) => void,
): void {
  for (const target of targets()) {
    describe(`${feature} on ${target.name}`, () => {
      let opened: OpenTestDatabase | undefined;

      const handle: EveryDatabaseHandle = {
        name: target.name,
        get database() {
          if (!opened) throw new Error("The database is only available inside tests and hooks.");
          return opened.database;
        },
      };

      beforeAll(async () => {
        opened = await target.open();
        await opened.applyMigrations();
      });
      beforeEach(() => opened?.emptyTables());
      afterAll(() => opened?.close());

      tests(handle);
    });
  }
}
