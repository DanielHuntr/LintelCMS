import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { type StorageDriver, StorageUnreachableError } from "../media/storage-driver.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { checkReadiness } from "./readiness.service.js";

describe("GET /ready", () => {
  const testDatabase = useTestDatabase();
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-ready-"));
  });
  afterEach(() => rm(folder, { recursive: true, force: true }));

  it("is ready when the database, its tables and storage are all fine", async () => {
    const server = await startTestServer(testDatabase.activeDatabase, {
      media: { storage: new LocalDiskStorage(join(folder, "uploads")) },
    });
    const response = await server.inject({ method: "GET", url: "/ready" });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      status: "ready",
      checks: { database: "ok", migrations: "ok", storage: "ok" },
    });
  });

  it("is not ready when storage can't be reached, without saying why to the world", async () => {
    const brokenBucket: StorageDriver = {
      ...new LocalDiskStorage(folder),
      put: async () => {},
      get: async () => {
        throw new Error("unused");
      },
      delete: async () => {},
      exists: async () => false,
      checkReachable: async () => {
        throw new StorageUnreachableError("the access keys aren't allowed to use the bucket");
      },
    };
    const server = await startTestServer(testDatabase.activeDatabase, {
      media: { storage: brokenBucket },
    });
    const response = await server.inject({ method: "GET", url: "/ready" });
    await server.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "not ready",
      checks: { database: "ok", migrations: "ok", storage: "failing" },
    });
    expect(response.body).not.toContain("access keys");
  });

  it("notices tables older than this version of Lintel", async () => {
    // A migrations folder whose newest step is from the far future.
    const futureFolder = join(folder, "migrations");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(futureFolder, "meta"), { recursive: true });
    await writeFile(
      join(futureFolder, "meta", "_journal.json"),
      JSON.stringify({ entries: [{ when: 9_999_999_999_999 }] }),
    );

    const report = await checkReadiness({
      database: testDatabase.database,
      storage: new LocalDiskStorage(join(folder, "uploads")),
      migrationsFolder: futureFolder,
    });

    expect(report.ready).toBe(false);
    expect(report.checks.migrations).toBe("failing");
    expect(report.problems[0]).toMatch(/older than this version of Lintel/);
  });
});
