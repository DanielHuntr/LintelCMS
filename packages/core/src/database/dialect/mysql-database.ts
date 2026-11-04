import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection, createPool } from "mysql2/promise";
import type { Database } from "../client.js";

/**
 * Opening MySQL and MariaDB. Only the dialect tests use this so far: the server can't run
 * on these databases yet, and `mysql2` is a development dependency until it can.
 * See docs/decisions/0049-any-database.md.
 */

export type MysqlEngine = "mysql" | "mariadb";

export interface OpenedMysqlDatabase {
  /** Typed as the Postgres `Database` that repositories accept (see README.md). */
  database: Database;
  engine: MysqlEngine;
  applyMigrations: () => Promise<void>;
  close: () => Promise<void>;
}

export const MYSQL_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../../migrations-mysql", import.meta.url),
);

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
 * For text a query works out rather than reads from a column. MySQL's JSON functions give
 * utf8mb4_bin and refuse to compare it with utf8mb4_0900_bin, so its connections use that.
 * Columns still win a comparison, so this doesn't loosen their exactness.
 */
const CONNECTION_COLLATIONS: Record<MysqlEngine, string> = {
  mysql: "utf8mb4_bin",
  mariadb: "utf8mb4_nopad_bin",
};

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

interface DatabaseFacts {
  version: string;
  collation: string;
  name: string;
}

async function readDatabaseFacts(url: string): Promise<DatabaseFacts> {
  const connection = await createConnection({ uri: url });
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

/** Opens a MySQL or MariaDB database. Every connection works in UTC. */
export async function openMysqlDatabase(url: string): Promise<OpenedMysqlDatabase> {
  const facts = await readDatabaseFacts(url);
  const engine = engineFromVersion(facts.version);
  const collation = exactCollationFor(engine);
  if (facts.collation !== collation) {
    throw new WrongDatabaseCollationError(facts.name, facts.collation, collation);
  }

  const pool = createPool({ uri: url, timezone: "Z", connectionLimit: 10, jsonStrings: true });
  pool.on("connection", (connection) => {
    // Sent first on each connection, so everything after it sees these.
    connection.query(
      `set time_zone = '+00:00', names utf8mb4 collate ${CONNECTION_COLLATIONS[engine]}`,
    );
  });
  const database = drizzle(pool, { mode: "default" });

  return {
    database: database as unknown as Database,
    engine,
    applyMigrations: () => migrate(database, { migrationsFolder: MYSQL_MIGRATIONS_FOLDER }),
    close: () => pool.end(),
  };
}
