import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lockDataFolder } from "../../database/data-folder-lock.js";
import { databaseCopiesFolder } from "../install-home.js";
import { DATABASE_COPIES_KEPT, FolderDatabaseCopies, locateDatabase } from "./database-copies.js";

describe("copies of the built-in database", { timeout: 60_000 }, () => {
  let home: string;
  let dataFolder: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "lintel-copies-"));
    dataFolder = join(home, ".lintel", "data");
    await mkdir(join(home, ".lintel"));
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  async function withDatabase<T>(work: (database: PGlite) => Promise<T>): Promise<T> {
    const database = new PGlite({ dataDir: dataFolder });
    try {
      return await work(database);
    } finally {
      await database.close();
    }
  }

  const columnsOf = (database: PGlite) =>
    database
      .query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name = 'orders' order by column_name",
      )
      .then((result) => result.rows.map((row) => row.column_name));

  // LINTEL-DATA-011: going back put the rows back but kept the newer version's tables.
  it("puts the tables back as well as the rows", async () => {
    await withDatabase(async (database) => {
      await database.exec("create table orders (id int primary key, total int)");
      await database.exec("insert into orders values (1, 450)");
    });
    const copies = new FolderDatabaseCopies(home, dataFolder);
    const copy = await copies.take({ fromVersion: "1.0.0", toVersion: "1.1.0" });

    // The newer version's migrations change the table and add another.
    await withDatabase(async (database) => {
      await database.exec("alter table orders add column currency text default 'GBP'");
      await database.exec("create table refunds (id int primary key)");
      await database.exec("insert into orders values (2, 900, 'EUR')");
    });

    await copies.restore(copy);

    await withDatabase(async (database) => {
      expect(await columnsOf(database)).toEqual(["id", "total"]);
      const refunds = await database.query(
        "select 1 from information_schema.tables where table_name = 'refunds'",
      );
      expect(refunds.rows).toHaveLength(0);
      const orders = await database.query<{ id: number; total: number }>(
        "select * from orders order by id",
      );
      expect(orders.rows).toEqual([{ id: 1, total: 450 }]);
    });
  });

  it("won't copy or replace the database while a server has it open", async () => {
    await mkdir(dataFolder, { recursive: true });
    const copies = new FolderDatabaseCopies(home, dataFolder);
    const lock = lockDataFolder(`${dataFolder}.lock`);
    try {
      await expect(copies.take({ fromVersion: "1.0.0", toVersion: "1.1.0" })).rejects.toThrow(
        /already in use/,
      );
    } finally {
      lock.release();
    }
  });

  it("can put a copy back again after being cut off part-way", async () => {
    await mkdir(dataFolder, { recursive: true });
    await writeFile(join(dataFolder, "tables"), "1.0.0");
    const copies = new FolderDatabaseCopies(home, dataFolder);
    const copy = await copies.take({ fromVersion: "1.0.0", toVersion: "1.1.0" });
    // Cut off after moving the database aside, before the copy took its place.
    await mkdir(`${dataFolder}.restoring`);
    await rm(dataFolder, { recursive: true });
    await copies.restore(copy);
    expect(await readdir(dataFolder)).toEqual(["tables"]);
  });

  it(`keeps the newest ${DATABASE_COPIES_KEPT} copies`, async () => {
    await mkdir(dataFolder, { recursive: true });
    let clock = Date.parse("2026-11-01T09:00:00Z");
    const copies = new FolderDatabaseCopies(home, dataFolder, () => new Date((clock += 60_000)));
    const ids = [];
    for (const toVersion of ["1.1.0", "1.2.0", "1.3.0", "1.4.0"]) {
      ids.push(await copies.take({ fromVersion: "1.0.0", toVersion }));
    }
    expect((await readdir(databaseCopiesFolder(home))).sort()).toEqual(ids.slice(1).sort());
  });

  it("finds the database the way the server does", () => {
    expect(locateDatabase({ DATABASE_URL: "postgres://x" }, join(home, ".lintel"))).toEqual({
      kind: "postgres",
      chosenBy: "environment",
    });
    expect(locateDatabase({}, join(home, ".lintel"))).toEqual({
      kind: "built-in",
      dataFolder,
    });
  });
});
