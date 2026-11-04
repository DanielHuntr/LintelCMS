import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createConnection } from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restoreBackupArchive, writeBackupArchive } from "../backups/backup-archive.service.js";
import { insertAllRows, readAllRows } from "../backups/database-snapshot.repository.js";
import { checkReadiness } from "../health/readiness.service.js";
import { definePlugin, type LintelPlugin } from "../plugins/plugin-definition.js";
import { isPluginRunning, listPlugins, setEnabledPlugins } from "../plugins/plugins.service.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { checkDatabase, checkDatabaseAddress } from "../server-check/server-check.service.js";
import { buildServer } from "../server.js";
import { addTestEntry, addTestUser, findEntryRow } from "../testing/every-database.js";
import { openBuiltInDatabase } from "./built-in-database.js";
import type { OpenedDatabase } from "./client.js";
import { MIGRATIONS_FOLDER } from "./client.js";
import { lintelFolderAt, readSavedDatabaseChoice } from "./database-choice.js";
import { ActiveDatabase, DatabaseConnectionError, openStartupDatabase } from "./active-database.js";
import { countAppliedMigrations, listKnownMigrations } from "./migration-status.js";
import {
  MYSQL_MIGRATIONS_FOLDER,
  buildMysqlUrl,
  engineFromVersion,
  exactCollationFor,
  isSupportedMysqlVersion,
} from "./dialect/mysql-database.js";
import { tableFor } from "./dialect/mysql-tables.js";
import { readRawRows } from "./dialect/raw-queries.js";
import { usersTable } from "../users/users.table.js";

/**
 * Lintel starting on real MySQL and MariaDB servers. Run by `pnpm test:dialects`, which
 * sets the two addresses. Each test works in a database of its own.
 */

const servers = [
  ["MySQL", process.env.TEST_MYSQL_URL],
  ["MariaDB", process.env.TEST_MARIADB_URL],
] as const;

function addressOf(serverUrl: string, database: string, user?: string, password?: string): string {
  const url = new URL(serverUrl);
  url.pathname = `/${database}`;
  if (user !== undefined) url.username = user;
  if (password !== undefined) url.password = password;
  return url.toString();
}

async function withConnection<T>(
  serverUrl: string,
  work: (query: (text: string) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const connection = await createConnection({ uri: serverUrl });
  try {
    return await work(async (text) => {
      const [rows] = await connection.query(text);
      return rows as unknown[];
    });
  } finally {
    await connection.end();
  }
}

const PUBLISHED_ENTRY = {
  id: randomUUID(),
  collection: "pages",
  slug: "home",
  title: "Home",
  url: "/",
  status: "published" as const,
  publishedAt: "2026-11-01T09:00:00.000Z",
};

async function pluginMysqlMigrations(folder: string) {
  const migrations = join(folder, "plugin-migrations");
  await mkdir(join(migrations, "meta"), { recursive: true });
  await writeFile(
    join(migrations, "0000_cards.sql"),
    "create table stamps_cards (id varchar(36) primary key, owner longtext not null);",
  );
  await writeFile(
    join(migrations, "meta", "_journal.json"),
    JSON.stringify({
      version: "5",
      dialect: "mysql",
      entries: [{ idx: 0, version: "5", when: 1, tag: "0000_cards", breakpoints: true }],
    }),
  );
  return migrations;
}

describe.each(servers.filter(([, url]) => url))("Lintel starting on %s", (_name, serverUrl) => {
  const url = serverUrl ?? "";
  let name: string;
  let folder: string;
  let collation: string;
  const opened: { close: () => Promise<void> }[] = [];

  beforeEach(async () => {
    name = `lintel_start_${Math.random().toString(36).slice(2, 10)}`;
    folder = await mkdtemp(join(tmpdir(), "lintel-mysql-start-"));
    await withConnection(url, async (query) => {
      const [row] = (await query("select version() as version")) as { version: string }[];
      collation = exactCollationFor(engineFromVersion(row?.version ?? ""));
      await query(`create database ${name} character set utf8mb4 collate ${collation}`);
    });
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((database) => database.close()));
    await withConnection(url, (query) => query(`drop database if exists ${name}`));
    await rm(folder, { recursive: true, force: true });
  });

  async function start(databaseUrl = addressOf(url, name)) {
    const active = await openStartupDatabase({
      databaseUrl,
      lintelFolder: lintelFolderAt(folder),
    });
    opened.push(active);
    return active;
  }

  it("opens from DATABASE_URL, whichever way it's written, and brings the tables up to date", async () => {
    const active = await start(addressOf(url, name).replace(/^mysql:/, "mariadb:"));
    expect(active.kind).toBe("mysql");
    expect(active.chosenBy).toBe("environment");
    expect(await countAppliedMigrations(active.database)).toBe(
      listKnownMigrations(MYSQL_MIGRATIONS_FOLDER).length,
    );
    const [row] = await readRawRows(active.database, sql`select count(*) as total from users`);
    expect(Number(row?.total)).toBe(0);
  });

  it("starts again on tables already up to date", async () => {
    const first = await start();
    await addTestUser(first.database);
    const again = await start();
    const users = tableFor(again.database, usersTable);
    expect(await again.database.select().from(users)).toHaveLength(1);
  });

  it("explains a wrong password", async () => {
    await expect(start(addressOf(url, name, "root", "wrong"))).rejects.toThrow(
      /turned down the user name or password for "root".*DATABASE_URL/s,
    );
  });

  it("explains a database that isn't there, and how to make one", async () => {
    const failure = await start(addressOf(url, "lintel_not_here")).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DatabaseConnectionError);
    expect((failure as DatabaseConnectionError).problem).toBe("not-found");
    expect((failure as Error).message).toContain('There\'s no database called "lintel_not_here"');
    expect((failure as Error).message).toContain("CREATE DATABASE `lintel_not_here`");
  });

  it("explains a server that isn't running", async () => {
    await expect(start("mysql://root:x@127.0.0.1:1/lintel")).rejects.toThrow(
      /can't reach MySQL or MariaDB at 127\.0\.0\.1:1/,
    );
  });

  it("refuses a database that ignores case, and says how to fix it", async () => {
    await withConnection(url, (query) =>
      query(`alter database ${name} character set utf8mb4 collate utf8mb4_general_ci`),
    );
    await expect(start()).rejects.toThrow(`alter database \`${name}\` character set utf8mb4`);
  });

  it("is ready once started, and not when a migration is missing", async () => {
    const active = await start();
    const storage = new LocalDiskStorage(folder);
    const report = await checkReadiness({ database: active.database, storage });
    expect(report.checks).toEqual({ database: "ok", migrations: "ok", storage: "ok" });

    await active.database.execute(sql`delete from __drizzle_migrations`);
    const missing = await checkReadiness({ database: active.database, storage });
    expect(missing.checks.migrations).toBe("failing");
  });

  it("names the server and its version in the server check", async () => {
    const active = await start();
    const check = await checkDatabase(active.database, "mysql");
    expect(check.status).toBe("pass");
    expect(check.detail).toMatch(/^(MySQL|MariaDB) \d+\.\d+/);
    expect((await checkDatabaseAddress(addressOf(url, name))).detail).toBe(check.detail);
  });

  it("is chosen and made on the setup screen, and remembered", async () => {
    const seed = await openBuiltInDatabase({});
    await seed.applyMigrations();
    const lintelFolder = lintelFolderAt(folder);
    const activeDatabase = new ActiveDatabase(seed, "default");
    const server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: activeDatabase,
      lintelFolder,
    });
    await server.ready();
    try {
      const parsed = new URL(url);
      const details = {
        kind: "mysql",
        host: parsed.hostname,
        port: Number(parsed.port),
        database: `${name}_made`,
        user: parsed.username,
        password: decodeURIComponent(parsed.password),
        ssl: false,
      };
      const missing = await server.inject({
        method: "POST",
        url: "/setup/database/test",
        payload: details,
      });
      expect(missing.statusCode).toBe(422);
      expect(missing.json<{ message: string }>().message).toContain("There's no database called");

      const finished = await server.inject({
        method: "POST",
        url: "/setup/finish",
        payload: {
          database: { ...details, createIfMissing: true },
          account: { email: "ada@example.com", name: "Ada", password: "correct horse battery" },
          site: { siteName: "Bakery", siteType: "blog" },
        },
      });
      expect(finished.statusCode).toBeLessThan(300);
      expect(activeDatabase.kind).toBe("mysql");
      expect(readSavedDatabaseChoice(lintelFolder)?.kind).toBe("mysql");
      const users = tableFor(activeDatabase.database, usersTable);
      const rows = await activeDatabase.database
        .select()
        .from(users)
        .where(eq(users.email, "ada@example.com"));
      expect(rows).toHaveLength(1);
    } finally {
      await server.close();
      await activeDatabase.close();
      await withConnection(url, (query) => query(`drop database if exists ${name}_made`));
    }
  }, 60_000);

  describe("plugins with tables of their own", () => {
    const tables = [
      pgTable("stamps_cards", { id: uuid("id").primaryKey(), owner: text("owner").notNull() }),
    ];

    const mysqlMigrations = () => pluginMysqlMigrations(folder);

    async function serverWith(database: LintelPlugin["database"]) {
      const active = await start();
      const server = buildServer({
        adminOrigin: "http://localhost:5173",
        database: active,
        runScheduledJobs: false,
        plugins: [
          definePlugin({
            id: "stamps",
            name: "Stamps",
            description: "Loyalty stamps.",
            ...(database ? { database } : {}),
          }),
        ],
      });
      await server.ready();
      opened.push({ close: async () => void (await server.close()) });
      return { active, server };
    }

    it("stays off when it has no migrations for MySQL, and says why", async () => {
      const { active, server } = await serverWith({ tables, migrationsFolder: folder });
      const plugins = await listPlugins(active.database, server.plugins);
      expect(plugins.plugins.find(({ id }) => id === "stamps")).toMatchObject({
        enabled: false,
        canRunHere: false,
      });
      await expect(setEnabledPlugins(active.database, server.plugins, ["stamps"])).rejects.toThrow(
        "made for Postgres",
      );
    });

    it("gets its tables and can be switched on when it has", async () => {
      const { active, server } = await serverWith({
        tables,
        migrationsFolder: folder,
        mysqlMigrationsFolder: await mysqlMigrations(),
      });
      const listed = await setEnabledPlugins(active.database, server.plugins, ["stamps"]);
      expect(listed.plugins.find(({ id }) => id === "stamps")).toMatchObject({
        enabled: true,
        canRunHere: true,
      });
      const [table] = tables;
      if (!table) throw new Error("There is no table.");
      const cards = tableFor(active.database, table);
      await active.database.insert(cards).values({ id: randomUUID(), owner: "Ada" });
      expect(await active.database.select().from(cards)).toHaveLength(1);
    });
  });

  describe("a plugin that was on in a backup from Postgres", () => {
    const tables = [
      pgTable("stamps_cards", { id: uuid("id").primaryKey(), owner: text("owner").notNull() }),
    ];

    function plugin(database: LintelPlugin["database"], counts: { job: number; event: number }) {
      return definePlugin({
        id: "stamps",
        name: "Stamps",
        description: "Loyalty stamps.",
        ...(database ? { database } : {}),
        routes: async (server) => {
          server.get("/stamps", async () => ({ cards: [] }));
        },
        jobs: [
          {
            id: "tidy",
            name: "Tidying",
            everyMinutes: 60,
            run: async () => {
              counts.job += 1;
            },
          },
        ],
        events: {
          "entry.published": async () => {
            counts.event += 1;
          },
        },
        formConsent: async () => "Tick to join",
        liquid: { tags: [{ name: "stamps_count", render: async () => "3 stamps" }] },
      });
    }

    async function serverRunning(database: LintelPlugin["database"]) {
      const counts = { job: 0, event: 0 };
      const active = await start();
      await writeSetting(active.database, "enabledPlugins", ["stamps"]);
      const server = buildServer({
        adminOrigin: "http://localhost:5173",
        database: active,
        runScheduledJobs: true,
        plugins: [plugin(database, counts)],
      });
      await server.ready();
      opened.push({ close: async () => void (await server.close()) });
      await server.events.publish("entry.published", { entry: PUBLISHED_ENTRY });
      return { active, server, counts };
    }

    it("does nothing at all where its tables can't be", async () => {
      const { active, server, counts } = await serverRunning({
        tables,
        migrationsFolder: folder,
      });

      // A job first runs as the server starts, and checks a setting before it does.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(counts).toEqual({ job: 0, event: 0 });
      const stamps = server.plugins.find("stamps");
      expect(stamps && (await isPluginRunning(active.database, stamps))).toBe(false);
      expect((await server.inject({ method: "GET", url: "/stamps" })).statusCode).toBe(404);
      const listed = await listPlugins(active.database, server.plugins);
      expect(listed.plugins.find(({ id }) => id === "stamps")?.enabled).toBe(false);
      // Still in the list, for a move back to Postgres.
      expect(await readSetting(active.database, "enabledPlugins")).toEqual(["stamps"]);
    });

    it("keeps working when it brings MySQL migrations", async () => {
      const { active, server, counts } = await serverRunning({
        tables,
        migrationsFolder: folder,
        mysqlMigrationsFolder: await pluginMysqlMigrations(folder),
      });

      await vi.waitFor(() => expect(counts).toEqual({ job: 1, event: 1 }));
      const stamps = server.plugins.find("stamps");
      expect(stamps && (await isPluginRunning(active.database, stamps))).toBe(true);
    });
  });

  it("keeps an add-on's own table in a backup, in the form Postgres writes", async () => {
    const active = await start();
    const { database } = active;
    await database.execute(sql`create table stamps_cards (
      id varchar(36) primary key, picture longblob, active boolean, details json,
      stamped_at datetime(3), note longtext
    )`);
    // As `row_to_json` writes them, with a note that only looks like a time.
    const fromPostgres = {
      id: randomUUID(),
      picture: "\\x89504e4700ff",
      active: true,
      details: { stamps: 3, shop: "Über" },
      stamped_at: "2026-03-04T05:06:07.89+01:00",
      note: "2026-03-04T05:06:07 was the day",
    };
    await insertAllRows(database, "stamps_cards", [fromPostgres]);

    expect(await readAllRows(database, "stamps_cards")).toEqual([
      { ...fromPostgres, stamped_at: "2026-03-04T04:06:07.890Z" },
    ]);
  });

  async function fillAndBackUp(from: OpenedDatabase | ActiveDatabase, kind: "built-in" | "mysql") {
    const { database } = from;
    const owner = await addTestUser(database);
    const parent = await addTestEntry(database, {
      slug: "about",
      data: { title: "Über uns", list: [1, "two"], nested: { a: true } },
      publishedData: { title: "Über uns" },
      publishedAt: new Date("2026-03-04T05:06:07.890Z"),
      createdBy: owner.id,
    });
    const child = await addTestEntry(database, { slug: "team", parentId: parent.id });
    const file = join(folder, `${kind}.zip`);
    await writeBackupArchive(
      { database, databaseKind: kind, storage: new LocalDiskStorage(folder) },
      file,
    );
    return { file, parentId: parent.id, childId: child.id };
  }

  async function expectRestored(
    to: OpenedDatabase | ActiveDatabase,
    { parentId, childId }: { parentId: string; childId: string },
  ) {
    const parent = await findEntryRow(to.database, parentId);
    const child = await findEntryRow(to.database, childId);
    expect(parent?.data).toEqual({ title: "Über uns", list: [1, "two"], nested: { a: true } });
    expect(parent?.publishedData).toEqual({ title: "Über uns" });
    expect(parent?.publishedAt?.toISOString()).toBe("2026-03-04T05:06:07.890Z");
    expect(child?.parentId).toBe(parentId);
    const users = tableFor(to.database, usersTable);
    expect(await to.database.select().from(users)).toHaveLength(1);
  }

  it("backs up and restores its own data", async () => {
    const active = await start();
    const backup = await fillAndBackUp(active, "mysql");
    await active.database.execute(sql`delete from revisions`);
    await restoreBackupArchive(
      { database: active.database, databaseKind: "mysql", storage: new LocalDiskStorage(folder) },
      backup.file,
    );
    await expectRestored(active, backup);
  }, 60_000);

  it("takes a backup from the built-in database, and gives one back to it", async () => {
    const builtIn = await openBuiltInDatabase({});
    opened.push(builtIn);
    await builtIn.applyMigrations();
    const backup = await fillAndBackUp(builtIn, "built-in");

    const active = await start();
    const context = {
      database: active.database,
      databaseKind: "mysql" as const,
      storage: new LocalDiskStorage(folder),
    };
    await restoreBackupArchive(context, backup.file);
    await expectRestored(active, backup);

    const returned = join(folder, "returned.zip");
    await writeBackupArchive(context, returned);
    const fresh = await openBuiltInDatabase({});
    opened.push(fresh);
    await fresh.applyMigrations();
    await restoreBackupArchive(
      { database: fresh.database, databaseKind: "built-in", storage: new LocalDiskStorage(folder) },
      returned,
    );
    await expectRestored(fresh, backup);
  }, 120_000);
});

describe("telling MySQL and MariaDB apart", () => {
  it("knows a version it has been tested on", () => {
    expect(isSupportedMysqlVersion("8.4.3")).toBe(true);
    expect(isSupportedMysqlVersion("9.1.0")).toBe(true);
    expect(isSupportedMysqlVersion("8.0.36")).toBe(false);
    expect(isSupportedMysqlVersion("11.4.2-MariaDB-ubu2404")).toBe(true);
    expect(isSupportedMysqlVersion("10.11.6-MariaDB")).toBe(false);
  });

  it("writes an address that survives any password", () => {
    const address = buildMysqlUrl({
      host: "::1",
      port: 3306,
      database: "lin tel",
      user: "ada",
      password: "pa#ss/word",
      ssl: true,
    });
    expect(address).toBe("mysql://ada:pa%23ss%2Fword@[::1]:3306/lin%20tel?ssl=require");
  });

  it("keeps Postgres's migrations apart from MySQL's", () => {
    expect(MYSQL_MIGRATIONS_FOLDER).not.toBe(MIGRATIONS_FOLDER);
  });
});
