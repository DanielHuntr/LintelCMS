import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { MIGRATIONS_FOLDER, type DatabaseOrTransaction } from "./client.js";

/**
 * Which migrations this copy of Lintel knows about, and how many a database has had.
 * Backups record the first so a restore can tell whether the backup came from a newer
 * Lintel; `lintel doctor` and `lintel migrate` use the second.
 */

const journalSchema = z.object({
  entries: z.array(z.object({ idx: z.number(), tag: z.string() })),
});

/** The migrations shipped with this copy of Lintel, oldest first, such as "0004_add_media". */
export function listKnownMigrations(migrationsFolder = MIGRATIONS_FOLDER): string[] {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8")),
  );
  return [...journal.entries].sort((first, second) => first.idx - second.idx).map((e) => e.tag);
}

/** How many migrations have been applied: 0 for a database that has never been set up. */
export async function countAppliedMigrations(database: DatabaseOrTransaction): Promise<number> {
  try {
    const result: unknown = await database.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] } | null)?.rows ?? []);
    const [first] = rows as Array<{ count?: unknown }>;
    return Number(first?.count ?? 0);
  } catch {
    // The table doesn't exist until the first migration runs.
    return 0;
  }
}
