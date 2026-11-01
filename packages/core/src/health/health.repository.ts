import { sql } from "drizzle-orm";
import type { Database } from "../database/client.js";

/** Database reads for `GET /ready`, nothing else. */

/** A query that needs nothing but a working connection. */
export async function pingDatabase(database: Database): Promise<void> {
  await database.execute(sql`select 1`);
}

/**
 * When the newest applied migration was made, from Drizzle's own bookkeeping table, or
 * undefined if no migration has run. `created_at` there is the journal's `when`.
 */
export async function findNewestAppliedMigration(database: Database): Promise<number | undefined> {
  const result: unknown = await database.execute(
    sql`select max(created_at) as newest from drizzle.__drizzle_migrations`,
  );
  const newest = rowsOf(result)[0]?.newest;
  return newest === null || newest === undefined ? undefined : Number(newest);
}

/** The built-in database answers `{ rows }`; postgres.js answers the rows themselves. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (
    typeof result === "object" &&
    result !== null &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as Record<string, unknown>[];
  }
  return [];
}
