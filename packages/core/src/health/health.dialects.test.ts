import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { appliedMigrationsTable } from "../database/dialect/raw-queries.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import { findNewestAppliedMigration, pingDatabase } from "./health.repository.js";

/** Stops a transaction on purpose, so what it did is undone. */
class UndoEverything extends Error {}

function newestInJournal(folder: "migrations" | "migrations-mysql"): number {
  const path = fileURLToPath(new URL(`../../${folder}/meta/_journal.json`, import.meta.url));
  const journal = JSON.parse(readFileSync(path, "utf8")) as { entries: Array<{ when: number }> };
  return Math.max(...journal.entries.map((entry) => entry.when));
}

describeOnEveryDatabase("Readiness checks", (handle) => {
  it("reaches the database", async () => {
    await expect(pingDatabase(handle.database)).resolves.toBeUndefined();
  });

  it("reads when the newest applied migration was made", async () => {
    const folder = handle.name === "built-in" ? "migrations" : "migrations-mysql";
    const newest = await findNewestAppliedMigration(handle.database);
    expect(newest).toBe(newestInJournal(folder));
  });

  it("finds nothing when no migration has run", async () => {
    await expect(
      handle.database.transaction(async (transaction) => {
        await transaction.execute(sql`delete from ${appliedMigrationsTable(transaction)}`);
        expect(await findNewestAppliedMigration(transaction as Database)).toBeUndefined();
        throw new UndoEverything();
      }),
    ).rejects.toBeInstanceOf(UndoEverything);
    expect(await findNewestAppliedMigration(handle.database)).toBeTypeOf("number");
  });
});
