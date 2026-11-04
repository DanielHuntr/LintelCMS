import { sql } from "drizzle-orm";
import type { Database } from "../database/client.js";
import { appliedMigrationsTable, readRawRows } from "../database/dialect/raw-queries.js";

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
  const [row] = await readRawRows(
    database,
    sql`select max(created_at) as newest from ${appliedMigrationsTable(database)}`,
  );
  const newest = row?.newest;
  return newest === null || newest === undefined ? undefined : Number(newest);
}
