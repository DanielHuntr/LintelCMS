import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sitesTable } from "../sites/sites.table.js";
import { DatabaseConnectionError, openStartupDatabase } from "./active-database.js";
import { openBuiltInDatabase } from "./built-in-database.js";
import { DataFolderInUseError } from "./data-folder-lock.js";
import {
  type LintelFolder,
  lintelFolderAt,
  readSavedDatabaseChoice,
  SavedConfigUnreadableError,
  saveDatabaseChoice,
} from "./database-choice.js";

// Creating a built-in database from nothing takes a few seconds.
const SLOW_TEST_TIMEOUT = 60_000;

describe("choosing the database on start", () => {
  let temporaryFolder: string;
  let lintelFolder: LintelFolder;

  beforeEach(async () => {
    temporaryFolder = await mkdtemp(join(tmpdir(), "lintel-start-"));
    lintelFolder = lintelFolderAt(temporaryFolder);
  });

  afterEach(() => rm(temporaryFolder, { recursive: true, force: true }));

  it(
    "uses the built-in database when nothing is set, keeps its data, and locks its folder",
    async () => {
      const first = await openStartupDatabase({ databaseUrl: undefined, lintelFolder });
      expect(first.kind).toBe("built-in");
      expect(first.chosenBy).toBe("default");

      // Another program (say `pnpm reset-password` while `pnpm dev` runs) must wait its turn.
      await expect(openBuiltInDatabase({ dataFolder: lintelFolder.dataFolder })).rejects.toThrow(
        DataFolderInUseError,
      );

      await first.database
        .insert(sitesTable)
        .values({ handle: "main", name: "Main", domain: "example.com" });
      await first.close();

      const second = await openStartupDatabase({ databaseUrl: undefined, lintelFolder });
      try {
        const sites = await second.database.select({ name: sitesTable.name }).from(sitesTable);
        expect(sites).toEqual([{ name: "Main" }]);
      } finally {
        await second.close();
      }
    },
    SLOW_TEST_TIMEOUT,
  );

  it("uses DATABASE_URL first, even when setup saved another choice", async () => {
    saveDatabaseChoice(lintelFolder, { kind: "built-in" });

    // Nothing listens there, so failing to connect proves DATABASE_URL was the one used.
    const starting = openStartupDatabase({
      databaseUrl: "postgres://lintel:lintel@127.0.0.1:1/lintel",
      lintelFolder,
    });

    await expect(starting).rejects.toThrow(DatabaseConnectionError);
    await expect(starting).rejects.toThrow(
      "Lintel can't reach Postgres at 127.0.0.1:1. Is it running?",
    );
  });

  it("uses the Postgres server chosen during setup, and says where that choice is saved", async () => {
    saveDatabaseChoice(lintelFolder, {
      kind: "postgres",
      host: "127.0.0.1",
      port: 1,
      database: "lintel",
      user: "lintel",
      password: "secret",
      ssl: false,
    });

    await expect(openStartupDatabase({ databaseUrl: undefined, lintelFolder })).rejects.toThrow(
      /127\.0\.0\.1:1.*\.lintel\/config\.json/s,
    );
  });

  it("explains a saved settings file that can't be read", async () => {
    await writeFile(lintelFolder.configFile, "{ not json");

    expect(() => readSavedDatabaseChoice(lintelFolder)).toThrow(SavedConfigUnreadableError);
    expect(() => readSavedDatabaseChoice(lintelFolder)).toThrow(/delete it/);
  });

  it(
    "takes over a lock left behind by a program that is no longer running",
    async () => {
      // A process id far above any real one stands in for a program that crashed.
      await writeFile(`${lintelFolder.dataFolder}.lock`, "2147483646");

      const opened = await openBuiltInDatabase({ dataFolder: lintelFolder.dataFolder });
      await opened.close();
    },
    SLOW_TEST_TIMEOUT,
  );
});
