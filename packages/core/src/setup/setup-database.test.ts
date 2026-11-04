import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ActiveDatabase, openStartupDatabase } from "../database/active-database.js";
import { type LintelFolder, lintelFolderAt } from "../database/database-choice.js";
import { targetFromUrl } from "../database/database-errors.js";
import { buildServer } from "../server.js";
import {
  emptyAllTables,
  openTestDatabase,
  testDatabaseUrl,
  testsRunOnMysql,
} from "../testing/test-database.js";

/**
 * The setup screen's database step: testing a connection, and the database choice applied
 * when setup finishes. Each test gets its own database and its own .lintel folder, because
 * choosing a database switches and closes the one in use.
 */

// The built-in database is created from nothing in some of these, which takes seconds.
const SLOW_TEST_TIMEOUT = 60_000;

const unreachableServer = {
  host: "127.0.0.1",
  // Nothing listens on port 1.
  port: 1,
  database: "lintel",
  user: "lintel",
  password: "",
  ssl: false,
};

describe("choosing the database during setup", () => {
  let temporaryFolder: string;
  let lintelFolder: LintelFolder;
  let activeDatabase: ActiveDatabase;
  let server: FastifyInstance;

  beforeEach(async () => {
    temporaryFolder = await mkdtemp(join(tmpdir(), "lintel-setup-"));
    lintelFolder = lintelFolderAt(temporaryFolder);
    const testDatabase = await openTestDatabase();
    // With TEST_DATABASE_URL every file shares one database, so start from empty.
    await emptyAllTables(testDatabase.database);
    activeDatabase = new ActiveDatabase(testDatabase, "default");
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: activeDatabase,
      lintelFolder,
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    await activeDatabase.close();
    await rm(temporaryFolder, { recursive: true, force: true });
  });

  /** Finishes setup with this database choice. */
  function choose(database: object) {
    return server.inject({
      method: "POST",
      url: "/setup/finish",
      payload: {
        database,
        account: { email: "ana@example.com", name: "Ana", password: "a long admin password" },
        site: { siteName: "Brightside", siteType: "business" },
      },
    });
  }

  async function databaseStatus() {
    const status = await server.inject({ method: "GET", url: "/setup/status" });
    return status.json().database;
  }

  function test(payload: object) {
    return server.inject({ method: "POST", url: "/setup/database/test", payload });
  }

  it(
    "keeps the built-in database when it is chosen, and remembers the choice",
    async () => {
      const response = await choose({ kind: "built-in" });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(await readFile(lintelFolder.configFile, "utf8"))).toEqual({
        database: { kind: "built-in" },
      });
      expect(await databaseStatus()).toEqual({ kind: "built-in", chosenBy: "setup" });
    },
    SLOW_TEST_TIMEOUT,
  );

  it("says plainly when the Postgres server can't be reached", async () => {
    const response = await test(unreachableServer);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: "DATABASE_UNREACHABLE",
      message: "Lintel can't reach Postgres at 127.0.0.1:1. Is it running?",
    });
  });

  it("doesn't switch or save anything when the chosen Postgres can't be used", async () => {
    const response = await choose({ kind: "postgres", ...unreachableServer });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "DATABASE_UNREACHABLE", step: "database" });
    await expect(stat(lintelFolder.configFile)).rejects.toThrow();
    expect(activeDatabase.chosenBy).toBe("default");
    const status = await server.inject({ method: "GET", url: "/setup/status" });
    expect(status.json().needsSetup).toBe(true);
  });

  it("checks the details sent for a Postgres server", async () => {
    const response = await test({ host: "", port: "not a port", database: "lintel", user: "" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
    expect(response.json().message).toContain("Please enter the server's address");
    expect(response.json().message).toContain("The port should be a number");
    expect(response.json().message).toContain("Please enter the user name");
  });

  it("leaves a database set by DATABASE_URL alone, and finishes on it", async () => {
    activeDatabase.recordChosenBy("environment");

    const response = await choose({ kind: "postgres", ...unreachableServer });

    expect(response.statusCode).toBe(201);
    expect(activeDatabase.chosenBy).toBe("environment");
    await expect(stat(lintelFolder.configFile)).rejects.toThrow();
  });

  it("refuses to test a connection when DATABASE_URL set the database", async () => {
    activeDatabase.recordChosenBy("environment");

    const response = await test(unreachableServer);

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("DATABASE_URL");
  });

  describe.skipIf(!testDatabaseUrl || testsRunOnMysql)(
    "with a real Postgres server (TEST_DATABASE_URL)",
    () => {
      // A user whose password has every character that breaks a hand-written URL.
      const specialUser = "lintel_setup_test";
      const specialPassword = "p#ss@w/rd 100%";
      const createdDatabase = `lintel_setup_test_${process.pid}`;
      const testServer = testDatabaseUrl ? targetFromUrl(testDatabaseUrl) : unreachableServer;
      const testPassword = testDatabaseUrl
        ? decodeURIComponent(new URL(testDatabaseUrl).password)
        : "";
      const testServerDetails = {
        host: testServer.host,
        port: testServer.port,
        database: testServer.database,
        user: testServer.user,
        password: testPassword,
        ssl: false,
      };
      let administrator: postgres.Sql;

      beforeAll(async () => {
        administrator = postgres(testDatabaseUrl!, { max: 1, onnotice: () => {} });
        await dropCreated();
        // CREATE ROLE can't take its password as a query parameter, so it is quoted here.
        const quotedPassword = `'${specialPassword.replaceAll("'", "''")}'`;
        await administrator.unsafe(
          `create role ${specialUser} login createdb password ${quotedPassword}`,
        );
      });

      afterAll(async () => {
        await dropCreated();
        await administrator.end();
      });

      async function dropCreated() {
        await administrator`drop database if exists ${administrator(createdDatabase)} with (force)`;
        await administrator`drop role if exists ${administrator(specialUser)}`;
      }

      it("connects with the right details", async () => {
        const response = await test(testServerDetails);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ ok: true });
      });

      it("says when the password is wrong", async () => {
        const response = await test({ ...testServerDetails, password: "not the password" });

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({
          code: "DATABASE_AUTH_FAILED",
          message: `Postgres turned down the password for "${testServer.user}".`,
        });
      });

      it("says when the database doesn't exist yet", async () => {
        const response = await test({ ...testServerDetails, database: "lintel_does_not_exist" });

        expect(response.statusCode).toBe(422);
        expect(response.json()).toMatchObject({ code: "DATABASE_NOT_FOUND" });
        expect(response.json().message).toContain('"lintel_does_not_exist"');
      });

      it(
        "creates the database, switches to it and remembers it, with a password full of #, @ and /",
        async () => {
          const details = {
            ...testServerDetails,
            database: createdDatabase,
            user: specialUser,
            password: specialPassword,
          };

          const withoutCreating = await choose({ kind: "postgres", ...details });
          expect(withoutCreating.json()).toMatchObject({
            code: "DATABASE_NOT_FOUND",
            step: "database",
          });

          const response = await choose({ kind: "postgres", ...details, createIfMissing: true });

          // The running server switched to it and finished setup there.
          expect(response.statusCode).toBe(201);
          expect(await databaseStatus()).toEqual({ kind: "postgres", chosenBy: "setup" });
          const [owner] = await administrator<{ owner: string }[]>`
          select pg_get_userbyid(datdba) as owner from pg_database where datname = ${createdDatabase}`;
          expect(owner?.owner).toBe(specialUser);

          // The choice is saved, readable only by its owner, and used on the next start.
          const saved = JSON.parse(await readFile(lintelFolder.configFile, "utf8"));
          expect(saved).toEqual({ database: { kind: "postgres", ...details } });
          if (process.platform !== "win32") {
            expect((await stat(lintelFolder.configFile)).mode & 0o777).toBe(0o600);
          }

          const restarted = await openStartupDatabase({ databaseUrl: undefined, lintelFolder });
          try {
            expect(restarted.kind).toBe("postgres");
            expect(restarted.chosenBy).toBe("setup");
            const restartedServer = buildServer({
              adminOrigin: "http://localhost:5173",
              database: restarted,
              lintelFolder,
            });
            const status = await restartedServer.inject({ method: "GET", url: "/setup/status" });
            expect(status.json()).toMatchObject({
              needsSetup: false,
              database: { kind: "postgres", chosenBy: "setup" },
            });
            await restartedServer.close();
          } finally {
            await restarted.close();
          }
        },
        SLOW_TEST_TIMEOUT,
      );

      it(
        "prefers DATABASE_URL over the choice saved during setup",
        async () => {
          expect((await choose({ kind: "built-in" })).statusCode).toBe(201);

          const started = await openStartupDatabase({ databaseUrl: testDatabaseUrl, lintelFolder });
          try {
            expect(started.kind).toBe("postgres");
            expect(started.chosenBy).toBe("environment");
          } finally {
            await started.close();
          }
        },
        SLOW_TEST_TIMEOUT,
      );
    },
  );
});
