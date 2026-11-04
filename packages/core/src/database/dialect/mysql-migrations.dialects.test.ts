import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateMySQLDrizzleJson } from "drizzle-kit/api";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../schema.js";
import { mysqlLocksTable } from "./locks.js";
import { MYSQL_MIGRATIONS_FOLDER, openMysqlDatabase } from "./mysql-database.js";
import { mysqlTableFor } from "./mysql-tables.js";

interface Snapshot {
  tables: Record<string, unknown>;
}

function newestSnapshot(): Snapshot {
  const folder = join(MYSQL_MIGRATIONS_FOLDER, "meta");
  const newest = readdirSync(folder)
    .filter((name) => name.endsWith("_snapshot.json"))
    .sort()
    .at(-1);
  if (!newest) throw new Error("There are no MySQL migrations.");
  return JSON.parse(readFileSync(join(folder, newest), "utf8")) as Snapshot;
}

function everyPostgresTable() {
  return Object.values(schema).filter((value) => is(value, PgTable));
}

/** Run by `pnpm test:dialects`. Only there, so a table change needn't wait for MySQL. */
describe.runIf(process.env.TEST_MYSQL_URL)("MySQL migrations", () => {
  it("match the tables: run `pnpm db:generate:mysql` if this fails", async () => {
    const tables = {
      ...Object.fromEntries(
        everyPostgresTable().map((table) => [getTableName(table), mysqlTableFor(table)]),
      ),
      lintel_locks: mysqlLocksTable,
    };
    const current = (await generateMySQLDrizzleJson(tables)) as Snapshot;
    expect(current.tables).toEqual(newestSnapshot().tables);
  });

  it.each([
    ["MySQL", "TEST_MYSQL_URL"],
    ["MariaDB", "TEST_MARIADB_URL"],
  ])("creates every table on %s", async (_name, variable) => {
    const opened = await openMysqlDatabase(process.env[variable] ?? "");
    await opened.applyMigrations();
    const result = (await opened.database.execute(
      "select table_name as name from information_schema.tables where table_schema = database()",
    )) as unknown as [{ name: string }[]];
    await opened.close();
    const created = result[0].map((row) => row.name);
    for (const table of everyPostgresTable()) {
      expect(created).toContain(getTableName(table));
    }
  });
});
