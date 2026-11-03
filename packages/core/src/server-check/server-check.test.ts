import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostingChecker, HostingReport } from "../cli/hosting-checker.js";
import { runCommandLine } from "../cli/lintel.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import {
  checkDatabase,
  checkDatabaseAddress,
  checkThisServer,
  summarise,
} from "./server-check.service.js";

/** A checker that reports what it is told, so the tests don't depend on this computer. */
function fakeChecker(checks: HostingReport["checks"]): HostingChecker {
  return {
    gatherFacts: (_folder, callback) => callback({}),
    buildReport: () => summarise(checks),
    formatText: (report) => report.headline,
  };
}

const healthy: HostingReport["checks"] = [
  { name: "Node.js version", status: "pass", detail: "Node.js 22.12.0" },
  { name: "Memory", status: "pass", detail: "2048 MB" },
  { name: "Built-in database", status: "pass", detail: "Can run here" },
  { name: "Saving files", status: "pass", detail: "Lintel can save its files here" },
];

describe("checking this server", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance | undefined;
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-server-check-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });

  it("adds the database Lintel really uses to the hosting checker's report", async () => {
    const report = await checkThisServer({
      database: testDatabase.database,
      databaseKind: "built-in",
      folders: [folder],
      checker: fakeChecker(healthy),
    });

    expect(report.verdict).toBe("runs");
    expect(report.headline).toBe("Everything Lintel needs is here.");
    expect(report.checks.map((check) => check.name)).toEqual([
      "Node.js version",
      "Memory",
      "Database",
      "Saving files",
    ]);
  });

  it("puts Postgres in place of the built-in database, and says what to ask the host", async () => {
    const report = await checkThisServer({
      database: null,
      databaseKind: "postgres",
      folders: [folder],
      checker: fakeChecker([
        ...healthy,
        {
          name: "Internet access",
          status: "warn",
          detail: "This server couldn't reach the internet",
          askHost: "Please allow outgoing HTTPS connections (port 443) from my Node.js app.",
        },
      ]),
    });

    expect(report.verdict).toBe("blocked");
    expect(report.checks.map((check) => check.name)).not.toContain("Built-in database");
    expect(report.checks.find((check) => check.name === "Database")?.status).toBe("fail");
    expect(report.askHost).toEqual([
      "Please allow outgoing HTTPS connections (port 443) from my Node.js app.",
    ]);
  });

  it("says plainly when Postgres can't be reached", async () => {
    const check = await checkDatabaseAddress("postgres://lintel:wrong@127.0.0.1:1/lintel");

    expect(check.status).toBe("fail");
    expect(check.detail).toMatch(/^Lintel can't reach its database \(.+\)\. Check DATABASE_URL/);
  });

  it("answers the check for the people who look after the site, and nobody else", async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:read"]]);

    const owner = await server.inject({
      method: "GET",
      url: "/system/server-check",
      cookies: await signInAndGetCookies(server, "owner@example.com"),
    });
    expect(owner.statusCode, owner.body).toBe(200);
    expect(owner.headers["cache-control"]).toBe("no-store");
    const report = owner.json() as HostingReport;
    expect(report.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(["Node.js version", "Memory", "Database", "Saving files"]),
    );
    expect(report.checks.find((check) => check.name === "Database")?.status).toBe("pass");

    const writer = await server.inject({
      method: "GET",
      url: "/system/server-check",
      cookies: await signInAndGetCookies(server, "writer@example.com"),
    });
    expect(writer.statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: "/system/server-check" })).statusCode).toBe(
      401,
    );
  });

  it("checks the database in use", async () => {
    expect(
      (await checkDatabase(testDatabase.database, testDatabase.activeDatabase.kind)).status,
    ).toBe("pass");
  });

  it("is `lintel check` on the command line", async () => {
    let text = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      text += String(chunk);
      return true;
    });
    await runCommandLine(["help"]);
    expect(text).toContain("check                 Check this server");
  });
});
