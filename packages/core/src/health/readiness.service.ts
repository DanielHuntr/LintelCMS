import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Database, MIGRATIONS_FOLDER } from "../database/client.js";
import { dialectOf } from "../database/dialect/database-dialect.js";
import { MYSQL_MIGRATIONS_FOLDER } from "../database/dialect/mysql-database.js";
import type { StorageDriver } from "../media/index.js";
import { findNewestAppliedMigration, pingDatabase } from "./health.repository.js";

/**
 * Whether this server can do its job right now: the database answers, its tables are up to
 * date, and uploaded files can be stored. Load balancers send traffic only to servers that
 * are ready; uptime checks use `/health`, which never touches any of these.
 *
 * The answers are short and safe to show anyone. The reasons go to the log.
 */
export type CheckResult = "ok" | "failing";

export interface ReadinessReport {
  ready: boolean;
  checks: { database: CheckResult; migrations: CheckResult; storage: CheckResult };
  /** Plain-English reasons for anything failing, for the server's log only. */
  problems: string[];
}

export interface ReadinessContext {
  database: Database;
  storage: StorageDriver;
  migrationsFolder?: string;
}

export async function checkReadiness(context: ReadinessContext): Promise<ReadinessReport> {
  const problems: string[] = [];
  const database = await runCheck(problems, () => pingDatabase(context.database));
  const migrations =
    database === "ok" ? await runCheck(problems, () => checkMigrationsApplied(context)) : "failing";
  const storage = await runCheck(
    problems,
    () => context.storage.checkReachable?.() ?? Promise.resolve(),
  );

  return {
    ready: database === "ok" && migrations === "ok" && storage === "ok",
    checks: { database, migrations, storage },
    problems,
  };
}

async function runCheck(problems: string[], check: () => Promise<void>): Promise<CheckResult> {
  try {
    await check();
    return "ok";
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
    return "failing";
  }
}

async function checkMigrationsApplied(context: ReadinessContext): Promise<void> {
  const ownFolder =
    dialectOf(context.database) === "mysql" ? MYSQL_MIGRATIONS_FOLDER : MIGRATIONS_FOLDER;
  const newestAvailable = await newestMigrationInFolder(context.migrationsFolder ?? ownFolder);
  const newestApplied = await findNewestAppliedMigration(context.database);
  if (newestApplied === undefined || newestApplied < newestAvailable) {
    throw new Error(
      "The database's tables are older than this version of Lintel. They are updated when " +
        "the server starts; restart it, or run `pnpm db:migrate`.",
    );
  }
}

const journalCache = new Map<string, number>();

async function newestMigrationInFolder(folder: string): Promise<number> {
  const cached = journalCache.get(folder);
  if (cached !== undefined) return cached;

  const journal = JSON.parse(await readFile(join(folder, "meta", "_journal.json"), "utf8")) as {
    entries: { when: number }[];
  };
  const newest = Math.max(0, ...journal.entries.map((entry) => entry.when));
  journalCache.set(folder, newest);
  return newest;
}
