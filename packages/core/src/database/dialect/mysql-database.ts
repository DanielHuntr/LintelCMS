import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { type ConnectionOptions, createConnection, createPool } from "mysql2/promise";
import {
  type Database,
  type OpenedDatabase,
  type PluginMigrations,
  pluginMigrationsTable,
} from "../client.js";

/**
 * Opening MySQL and MariaDB. Both go through `mysql2`, and every query Lintel writes works on
 * both. Which of the two it is matters only for the collation and for naming it to people.
 * See docs/decisions/0049-any-database.md.
 */

export type MysqlEngine = "mysql" | "mariadb";

export interface OpenedMysqlDatabase extends OpenedDatabase {
  engine: MysqlEngine;
}

/** A MySQL or MariaDB server described field by field, as the setup screen collects it. */
export interface MysqlConnectionDetails {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface MysqlOptions {
  /** How long to wait for the server to answer. */
  connectTimeoutSeconds?: number;
}

export const MYSQL_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../../migrations-mysql", import.meta.url),
);

/** The oldest versions Lintel's whole test suite has run on. */
export const MINIMUM_MYSQL_VERSIONS: Record<MysqlEngine, string> = {
  // Below 8.0.16 MySQL has no check constraints, which migration 0003 needs. MariaDB's
  // `json_equals` came in 10.7, and 10.11 is the oldest of its long-term versions run here.
  mysql: "8.0.16",
  mariadb: "10.11",
};

/**
 * Postgres compares text exactly, so these must too. The usual defaults ignore case and
 * accents, and plain `utf8mb4_bin` ignores trailing spaces, so "Lora" and "Lora " would
 * clash in a unique key. These two are the exact ones on each engine.
 */
const EXACT_COLLATIONS: Record<MysqlEngine, string> = {
  mysql: "utf8mb4_0900_bin",
  mariadb: "utf8mb4_nopad_bin",
};

/**
 * For text a query works out rather than reads from a column. The JSON functions of both
 * MySQL and MariaDB give utf8mb4_bin and refuse to compare it with anything else, so
 * connections use that. Columns still win a comparison, so this doesn't loosen their exactness.
 */
const CONNECTION_COLLATION = "utf8mb4_bin";

export class WrongDatabaseCollationError extends Error {
  constructor(databaseName: string, found: string, needed: string) {
    super(
      `The database "${databaseName}" compares text as ${found}, and Lintel needs ${needed}. ` +
        `Run: alter database \`${databaseName}\` character set utf8mb4 collate ${needed}`,
    );
    this.name = "WrongDatabaseCollationError";
  }
}

export function engineFromVersion(version: string): MysqlEngine {
  return version.toLowerCase().includes("mariadb") ? "mariadb" : "mysql";
}

export function exactCollationFor(engine: MysqlEngine): string {
  return EXACT_COLLATIONS[engine];
}

function versionNumbers(version: string): number[] {
  return (/^\d+(\.\d+)*/.exec(version)?.[0] ?? "0").split(".").map(Number);
}

/** Whether a server's version, as it says it, is one Lintel has been tested on or newer. */
export function isSupportedMysqlVersion(version: string): boolean {
  const found = versionNumbers(version);
  const minimum = versionNumbers(MINIMUM_MYSQL_VERSIONS[engineFromVersion(version)]);
  for (const [place, needed] of minimum.entries()) {
    const part = found[place] ?? 0;
    if (part !== needed) return part > needed;
  }
  return true;
}

/**
 * Builds a connection address from separate fields. The user, password and database name are
 * percent-encoded here, so nobody has to know that a "#" in a password must be "%23".
 */
export function buildMysqlUrl(details: MysqlConnectionDetails): string {
  // An IPv6 address such as ::1 has to be wrapped in brackets inside a URL.
  const host = details.host.includes(":") ? `[${details.host}]` : details.host;
  const user = encodeURIComponent(details.user);
  const password = details.password ? `:${encodeURIComponent(details.password)}` : "";
  const database = encodeURIComponent(details.database);
  const ssl = details.ssl ? "?ssl=require" : "";
  return `mysql://${user}${password}@${host}:${details.port}/${database}${ssl}`;
}

/** mysql2's options for an address. `mariadb://` is the same thing to it. */
function connectionOptions(url: string, options: MysqlOptions = {}): ConnectionOptions {
  const parsed = new URL(url.replace(/^mariadb:/, "mysql:"));
  const ssl = parsed.searchParams.get("ssl");
  parsed.searchParams.delete("ssl");
  return {
    uri: parsed.toString(),
    // As Postgres's `sslmode=require`: encrypted, without checking who signed the certificate.
    ...(ssl === "require" ? { ssl: { rejectUnauthorized: false } } : {}),
    ...(options.connectTimeoutSeconds
      ? { connectTimeout: options.connectTimeoutSeconds * 1000 }
      : {}),
  };
}

interface DatabaseFacts {
  version: string;
  collation: string;
  name: string;
}

async function readDatabaseFacts(url: string, options?: MysqlOptions): Promise<DatabaseFacts> {
  const connection = await createConnection(connectionOptions(url, options));
  try {
    const [rows] = await connection.query(
      "select version() as version, @@collation_database as collation, database() as name",
    );
    const [facts] = rows as DatabaseFacts[];
    if (!facts) throw new Error("The database didn't say what version it is.");
    return facts;
  } finally {
    await connection.end();
  }
}

/** The server's version as it says it, such as "11.4.2-MariaDB-ubu2404". */
export async function readMysqlVersion(url: string): Promise<string> {
  return (await readDatabaseFacts(url, { connectTimeoutSeconds: 10 })).version;
}

/** Connects once, so a wrong password or the wrong collation shows up straight away. */
export async function checkMysqlConnection(url: string, options?: MysqlOptions): Promise<void> {
  const facts = await readDatabaseFacts(url, options);
  const collation = exactCollationFor(engineFromVersion(facts.version));
  if (facts.collation !== collation) {
    throw new WrongDatabaseCollationError(facts.name, facts.collation, collation);
  }
}

/**
 * Creates a database that doesn't exist yet, comparing text as Lintel needs. Connected to no
 * database in particular, which MySQL allows.
 */
export async function createMysqlDatabase(
  details: MysqlConnectionDetails,
  options?: MysqlOptions,
): Promise<void> {
  const url = buildMysqlUrl({ ...details, database: "" });
  const connection = await createConnection(connectionOptions(url, options));
  try {
    const [rows] = await connection.query("select version() as version");
    const [facts] = rows as { version: string }[];
    const collation = exactCollationFor(engineFromVersion(facts?.version ?? ""));
    const name = connection.escapeId(details.database);
    await connection.query(`create database ${name} character set utf8mb4 collate ${collation}`);
  } finally {
    await connection.end();
  }
}

/** How often a transaction is tried in all, when the database picks it to give way. */
const TRANSACTION_ATTEMPTS = 4;

function isDeadlock(error: unknown): boolean {
  for (let current = error, depth = 0; current instanceof Error && depth < 5; depth += 1) {
    if ("code" in current && current.code === "ER_LOCK_DEADLOCK") return true;
    current = current.cause;
  }
  return false;
}

/**
 * MySQL breaks a deadlock by undoing one of the transactions and expecting it to be tried
 * again. Postgres needs this far less often, because it takes fewer locks on inserts. The
 * whole transaction has been undone by then, so running it again is safe. A transaction inside
 * another is a savepoint and doesn't come through here: it fails up to the outermost one.
 */
function retryTransactionsAfterDeadlock(database: { transaction: unknown }): void {
  type Transaction = (work: unknown, config: unknown) => Promise<unknown>;
  const transaction = (database.transaction as Transaction).bind(database);
  const retrying: Transaction = async (work, config) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await transaction(work, config);
      } catch (error) {
        if (attempt === TRANSACTION_ATTEMPTS || !isDeadlock(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 20 * Math.random()));
      }
    }
  };
  database.transaction = retrying;
}

/** Opens a MySQL or MariaDB database. Every connection works in UTC. */
export async function openMysqlDatabase(
  url: string,
  options?: MysqlOptions,
): Promise<OpenedMysqlDatabase> {
  const facts = await readDatabaseFacts(url, options);
  const engine = engineFromVersion(facts.version);
  const collation = exactCollationFor(engine);
  if (facts.collation !== collation) {
    throw new WrongDatabaseCollationError(facts.name, facts.collation, collation);
  }

  const pool = createPool({
    ...connectionOptions(url, options),
    timezone: "Z",
    connectionLimit: 10,
    jsonStrings: true,
  });
  pool.on("connection", (connection) => {
    // Sent first on each connection, so everything after it sees these.
    connection.query(`set time_zone = '+00:00', names utf8mb4 collate ${CONNECTION_COLLATION}`);
    // What Postgres does: each statement sees what is committed, so a read after waiting for
    // a lock sees the other writer's work. It also takes fewer locks, so deadlocks are rarer.
    connection.query("set session transaction isolation level read committed");
  });
  const database = drizzle(pool, { mode: "default" });
  retryTransactionsAfterDeadlock(database);

  return {
    database: database as unknown as Database,
    kind: "mysql",
    engine,
    applyMigrations: () => migrate(database, { migrationsFolder: MYSQL_MIGRATIONS_FOLDER }),
    applyPluginMigrations: async (plugins: readonly PluginMigrations[]) => {
      for (const { pluginId, mysqlMigrationsFolder } of plugins) {
        if (!mysqlMigrationsFolder) continue;
        await migrate(database, {
          migrationsFolder: mysqlMigrationsFolder,
          migrationsTable: pluginMigrationsTable(pluginId),
        });
      }
    },
    close: () => pool.end(),
  };
}
