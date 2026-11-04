import { eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { openMysqlDatabase } from "../database/dialect/mysql-database.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import * as schema from "../database/schema.js";
import { entriesTable } from "../entries/entries.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { usersTable } from "../users/users.table.js";
import { isMysqlUrl } from "../database/database-errors.js";
import { emptyAllTables, openTestDatabase, testDatabaseUrl } from "./test-database.js";

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
  // The whole suite on MySQL (`pnpm test:mysql`): that one database is all there is.
  if (testDatabaseUrl && isMysqlUrl(testDatabaseUrl)) {
    return [
      mysqlTarget(
        process.env.LINTEL_TEST_ENGINE === "mariadb" ? "mariadb" : "mysql",
        testDatabaseUrl,
      ),
    ];
  }
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

/** A person for rows that belong to one. */
export async function addTestUser(database: Database, email = "ada@example.com") {
  const [user] = await insertReturning(database, tableFor(database, usersTable), {
    email,
    name: "Ada",
  });
  if (!user) throw new Error("The test person was not saved.");
  return user;
}

/** A site for rows that belong to one. */
export async function addTestSite(database: Database, handle = "main") {
  const [site] = await insertReturning(database, tableFor(database, sitesTable), {
    handle,
    name: handle,
    domain: `${handle}.test`,
  });
  if (!site) throw new Error("The test site was not saved.");
  return site;
}

type EntryValues = Partial<typeof entriesTable.$inferInsert>;

/** An entry, in a collection and site made for it the first time. */
export async function addTestEntry(database: Database, values: EntryValues = {}) {
  const blueprints = tableFor(database, blueprintsTable);
  const collections = tableFor(database, collectionsTable);
  const sites = tableFor(database, sitesTable);
  const [site] = await database.select().from(sites).where(eq(sites.handle, "main"));
  const [collection] = await database
    .select()
    .from(collections)
    .where(eq(collections.handle, "pages"));
  const siteId = site?.id ?? (await addTestSite(database)).id;
  const collectionId = collection?.id ?? (await addTestCollection(database, blueprints)).id;

  const [entry] = await insertReturning(database, tableFor(database, entriesTable), {
    collectionId,
    siteId,
    slug: "home",
    ...values,
  });
  if (!entry) throw new Error("The test entry was not saved.");
  return entry;
}

async function addTestCollection(database: Database, blueprints: typeof blueprintsTable) {
  const [blueprint] = await insertReturning(database, blueprints, {
    handle: "page",
    name: "Page",
    kind: "entry",
  });
  const [collection] = await insertReturning(database, tableFor(database, collectionsTable), {
    handle: "pages",
    name: "Pages",
    blueprintId: blueprint?.id ?? "",
    routePattern: "/{slug}",
  });
  if (!collection) throw new Error("The test collection was not saved.");
  return collection;
}

export async function findEntryRow(database: Database, entryId: string) {
  const entries = tableFor(database, entriesTable);
  const [entry] = await database.select().from(entries).where(eq(entries.id, entryId));
  return entry;
}
