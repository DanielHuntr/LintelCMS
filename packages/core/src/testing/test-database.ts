import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { createDatabase, type Database } from "../database/client.js";

/**
 * Tests that need Postgres use a real one, named by TEST_DATABASE_URL. Without it they
 * are skipped (global-setup.ts says so once), so `pnpm test` still works on a laptop
 * with no database running.
 *
 * The database is emptied before every test, so never point this at real data.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

/** Use instead of `describe` for tests that need the database. */
export function describeWithDatabase(name: string, tests: () => void): void {
  if (testDatabaseUrl) {
    describe(name, tests);
  } else {
    describe.skip(`${name} (skipped: TEST_DATABASE_URL is not set)`, tests);
  }
}

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

export async function applyMigrations(databaseUrl: string): Promise<void> {
  // On every run after the first, Postgres sends "already exists, skipping" notices
  // for Drizzle's own bookkeeping table. They're expected, so don't print them.
  const connection = postgres(databaseUrl, { onnotice: () => {} });
  try {
    await migrate(drizzle(connection), { migrationsFolder });
  } finally {
    await connection.end();
  }
}

/**
 * Opens the test database for one test file and empties it before each test.
 * Call inside `describeWithDatabase`; read `.database` inside tests and hooks.
 */
export function useTestDatabase() {
  let opened: ReturnType<typeof createDatabase> | undefined;

  const handle = {
    get database(): Database {
      if (!opened) {
        throw new Error("The test database is only available inside tests and hooks.");
      }
      return opened.database;
    },
  };

  beforeAll(() => {
    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is not set.");
    }
    opened = createDatabase(testDatabaseUrl);
  });
  beforeEach(() => emptyAllTables(handle.database));
  afterAll(() => opened?.close());

  return handle;
}

/**
 * Removes every row from every table we own. Drizzle keeps its record of applied
 * migrations in a separate "drizzle" schema, so that survives.
 */
async function emptyAllTables(database: Database): Promise<void> {
  const tables = await database.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) {
    return;
  }

  const tableNames = tables.map((table) => sql.identifier(table.tablename));
  await database.execute(sql`truncate table ${sql.join(tableNames, sql`, `)} cascade`);
}
