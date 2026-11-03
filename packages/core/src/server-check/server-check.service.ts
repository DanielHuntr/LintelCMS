import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import {
  findHostingChecker,
  type HostingCheck,
  type HostingChecker,
  type HostingReport,
  runHostingChecks,
} from "../cli/hosting-checker.js";
import type { Database, DatabaseKind } from "../database/client.js";

/**
 * "Check this server": what Lintel needs from the machine it runs on, in plain English.
 * The hosting checker (src/hosting/files/lintel-check.cjs) looks at Node.js, memory,
 * folders it must write to, image resizing and outbound HTTPS; this adds the database
 * Lintel is really using. The same report is behind `lintel check` and Settings → This
 * server.
 */

/** Where `sharp` and Lintel's own packages are installed: the core package's folder. */
export const APP_FOLDER = fileURLToPath(new URL("../../", import.meta.url));

/** The oldest Postgres Lintel is tested with. */
export const MINIMUM_POSTGRES_MAJOR = 14;

export interface ServerCheckOptions {
  database: Database | null;
  databaseKind: DatabaseKind;
  /** Folders Lintel writes to: its data folder, uploads. */
  folders: string[];
  checker?: HostingChecker;
  appFolder?: string;
}

export async function checkThisServer(options: ServerCheckOptions): Promise<HostingReport> {
  const appFolder = options.appFolder ?? APP_FOLDER;
  const checker = options.checker ?? findHostingChecker(appFolder);
  const report = await runHostingChecks(checker, appFolder, options.folders);
  const database = await checkDatabase(options.database, options.databaseKind);
  // The built-in database check is about running it here: beside Postgres it doesn't apply.
  return summarise(withDatabaseCheck(report.checks, database, options.databaseKind));
}

export async function checkDatabase(
  database: Database | null,
  kind: DatabaseKind,
): Promise<HostingCheck> {
  if (!database) {
    return {
      name: "Database",
      status: "fail",
      detail: "Lintel couldn't open its database. The lines above say why.",
    };
  }
  try {
    if (kind === "built-in") {
      await database.execute(sql`select 1`);
      return {
        name: "Database",
        status: "pass",
        detail: "The built-in database is working. For a busy site, Postgres is faster.",
      };
    }
    return postgresCheck(readVersion(await database.execute(sql`show server_version`)));
  } catch (error) {
    return unreachable(error);
  }
}

/**
 * The same for `lintel check`, straight from DATABASE_URL: the running Lintel keeps its
 * own connections, and the built-in database can only be opened by one program at a time.
 */
export async function checkDatabaseAddress(databaseUrl: string): Promise<HostingCheck> {
  const client = postgres(databaseUrl, { max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    const rows = await client<Array<{ server_version: string }>>`show server_version`;
    return postgresCheck(readVersion(rows));
  } catch (error) {
    return unreachable(error);
  } finally {
    await client.end({ timeout: 2 });
  }
}

function postgresCheck(version: string): HostingCheck {
  const major = Number(version.split(".")[0]);
  if (Number.isFinite(major) && major < MINIMUM_POSTGRES_MAJOR) {
    return {
      name: "Database",
      status: "warn",
      detail: `Postgres ${version}. Lintel is tested with ${MINIMUM_POSTGRES_MAJOR} or newer; upgrade when you can.`,
      askHost: `Please upgrade my PostgreSQL database to version ${MINIMUM_POSTGRES_MAJOR} or newer.`,
    };
  }
  return { name: "Database", status: "pass", detail: `Postgres ${version} answers` };
}

function unreachable(error: unknown): HostingCheck {
  const problem = error instanceof Error ? error.message.split("\n")[0] : String(error);
  return {
    name: "Database",
    status: "fail",
    detail: `Lintel can't reach its database (${problem}). Check DATABASE_URL, and that the database server is running.`,
    askHost: "Please check my PostgreSQL database is running and accepts connections from my app.",
  };
}

/**
 * One Database row: it replaces the "could the built-in database run here" row, which only
 * stays when the built-in database is in use and that row has something to say.
 */
export function withDatabaseCheck(
  checks: readonly HostingCheck[],
  database: HostingCheck,
  kind: DatabaseKind,
): HostingCheck[] {
  return checks.flatMap((check) =>
    check.name === "Built-in database"
      ? kind === "built-in" && check.status !== "pass"
        ? [check, database]
        : [database]
      : [check],
  );
}

function readVersion(result: unknown): string {
  const rows = Array.isArray(result)
    ? result
    : typeof result === "object" && result !== null && "rows" in result
      ? (result as { rows: unknown }).rows
      : [];
  const first: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof first === "object" && first !== null) {
    const value = Object.values(first)[0];
    if (typeof value === "string") return value.split(" ")[0] ?? value;
  }
  return "unknown";
}

/** The verdict, headline and questions for the host, as the hosting checker words them. */
export function summarise(checks: HostingCheck[]): HostingReport {
  const verdict = checks.some((check) => check.status === "fail")
    ? "blocked"
    : checks.some((check) => check.status === "warn")
      ? "runs-with-limits"
      : "runs";
  const headline = {
    blocked: "Something here stops Lintel working properly.",
    "runs-with-limits": "Lintel runs here, with the notes below.",
    runs: "Everything Lintel needs is here.",
  }[verdict];
  const askHost = checks.flatMap((check) =>
    check.askHost && check.status !== "pass" ? [check.askHost] : [],
  );
  return { verdict, headline, checks, askHost };
}
