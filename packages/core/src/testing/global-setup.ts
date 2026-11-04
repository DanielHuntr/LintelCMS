import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER } from "../database/client.js";
import { isMysqlUrl } from "../database/database-errors.js";
import { openMysqlDatabase } from "../database/dialect/mysql-database.js";
import { connectToPostgres } from "../database/postgres-database.js";
import { testDatabaseUrl } from "./test-database.js";
import type { TestProject } from "vitest/node";

/**
 * Runs once before all test files (see vitest.config.ts). Brings the test database's
 * tables up to date: the Postgres server in TEST_DATABASE_URL if it is set, otherwise a
 * built-in database that every test file then starts from a copy of.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const templateFolder = await mkdtemp(join(tmpdir(), "lintel-test-"));
  const templateFile = join(templateFolder, "built-in-database.tar");

  if (testDatabaseUrl) {
    const opened = isMysqlUrl(testDatabaseUrl)
      ? await openMysqlDatabase(testDatabaseUrl)
      : connectToPostgres(testDatabaseUrl);
    await opened.applyMigrations();
    await opened.close();
  }

  // Made even when TEST_DATABASE_URL is set: the setup tests switch to a built-in database.
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  // Write everything out to the data files first, or the copy can miss the new tables.
  await client.query("checkpoint");
  const dump = await client.dumpDataDir("none");
  await writeFile(templateFile, Buffer.from(await dump.arrayBuffer()));
  await client.close();

  project.provide("builtInDatabaseTemplate", templateFile);

  return () => rm(templateFolder, { recursive: true, force: true });
}
