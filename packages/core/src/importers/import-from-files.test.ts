import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser } from "../testing/test-users.js";
import { importFromFiles } from "./import-from-files.js";

/** `lintel import <source> <file|url>`, as the command line runs it. */
describe("importing from the command line", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  let folder = "";

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-import-command-"));
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
  });
  afterEach(() => rm(folder, { recursive: true, force: true }));

  const options = (source: "wordpress" | "framer", inputs: string[], dryRun: boolean) => ({
    database: testDatabase.database,
    storage: new LocalDiskStorage(join(folder, "uploads")),
    importsFolder: join(folder, "imports"),
    publicApiUrl: "http://api.test",
    source,
    inputs,
    dryRun,
  });

  it("dry-runs a WordPress export, then imports a Framer collection", async () => {
    const bakery = join(
      import.meta.dirname,
      "..",
      "wordpress-import",
      "fixtures",
      "small-bakery.xml",
    );
    const dryRun = await importFromFiles({ ...options("wordpress", [bakery], true) });
    expect(dryRun.counts).toContainEqual(["post", 2, 1, 0]);

    const recipes = join(import.meta.dirname, "fixtures", "framer", "Recipes.csv");
    const done = await importFromFiles(options("framer", [recipes], false));
    expect(done.counts).toContainEqual(["entry", 2, 0, 0]);
    expect(done.notes.length).toBeGreaterThan(0);
  });

  it("refuses missing files and private addresses", async () => {
    await expect(importFromFiles(options("framer", ["/no/such.csv"], true))).rejects.toThrow(
      "There is no file",
    );
    await expect(
      importFromFiles(options("framer", ["http://127.0.0.1/export.csv"], true)),
    ).rejects.toThrow("private or local address");
  });
});
