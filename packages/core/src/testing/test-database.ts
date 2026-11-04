import { readFile } from "node:fs/promises";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { ActiveDatabase } from "../database/active-database.js";
import { openBuiltInDatabase } from "../database/built-in-database.js";
import type { Database, OpenedDatabase } from "../database/client.js";
import { isMysqlUrl } from "../database/database-errors.js";
import { openMysqlDatabase } from "../database/dialect/mysql-database.js";
import { connectToPostgres } from "../database/postgres-database.js";
import * as schema from "../database/schema.js";
import { emptyEveryMysqlTable } from "./mysql-test-database.js";

declare module "vitest" {
  export interface ProvidedContext {
    /** A file holding an already migrated built-in database, made by global-setup.ts. */
    builtInDatabaseTemplate: string;
  }
}

/**
 * Database tests run against the built-in database (PGlite) by default: nothing to
 * install, and each test file gets its own copy in memory. Set TEST_DATABASE_URL to run
 * them against a real Postgres server instead, as CI does, or a MySQL or MariaDB server
 * (see `pnpm test:mysql`).
 *
 * The database is emptied before every test, so never point TEST_DATABASE_URL at real data.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL || undefined;

/**
 * A fresh, migrated database for one test. Starting from the template takes a fraction
 * of a second, where creating a built-in database from nothing takes a few.
 */
export async function openTestDatabase(): Promise<OpenedDatabase> {
  if (testDatabaseUrl && isMysqlUrl(testDatabaseUrl)) {
    return openMysqlDatabase(testDatabaseUrl);
  }
  if (testDatabaseUrl) {
    return connectToPostgres(testDatabaseUrl);
  }
  const template = await readFile(inject("builtInDatabaseTemplate"));
  return openBuiltInDatabase({ startFrom: new Blob([template]) });
}

/**
 * Opens the test database for one test file and empties it before each test.
 * Read `.database` (or `.activeDatabase`, for `buildServer`) inside tests and hooks.
 */
export function useTestDatabase() {
  let opened: OpenedDatabase | undefined;

  const handle = {
    get database(): Database {
      if (!opened) {
        throw new Error("The test database is only available inside tests and hooks.");
      }
      return opened.database;
    },
    /** For `buildServer`. Closing the server leaves the shared test database open. */
    get activeDatabase(): ActiveDatabase {
      return new ActiveDatabase({ ...openedOrFail(), close: async () => {} }, "default");
    },
  };

  function openedOrFail(): OpenedDatabase {
    if (!opened) {
      throw new Error("The test database is only available inside tests and hooks.");
    }
    return opened;
  }

  beforeAll(async () => {
    opened = await openTestDatabase();
  });
  beforeEach(() => emptyAllTables(handle.database));
  afterAll(() => opened?.close());

  return handle;
}

/**
 * Removes every row from every table in the schema. Drizzle keeps its record of applied
 * migrations in a separate "drizzle" schema, so that survives.
 */
export async function emptyAllTables(database: Database): Promise<void> {
  if (testDatabaseUrl && isMysqlUrl(testDatabaseUrl)) {
    await emptyEveryMysqlTable(testDatabaseUrl);
    return;
  }
  const tableNames = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => sql.identifier(getTableName(table)));

  await database.execute(sql`truncate table ${sql.join(tableNames, sql`, `)} cascade`);
}
