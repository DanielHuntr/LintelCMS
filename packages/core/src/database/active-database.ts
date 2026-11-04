import type { Database, DatabaseKind, OpenedDatabase, PluginMigrations } from "./client.js";
import { openBuiltInDatabase } from "./built-in-database.js";
import {
  type DatabaseChoice,
  type LintelFolder,
  readSavedDatabaseChoice,
} from "./database-choice.js";
import {
  type DatabaseProblem,
  type DatabaseSettingsSource,
  type DatabaseTarget,
  type DescribedDatabaseError,
  describeDatabaseError,
  isMysqlUrl,
  targetFromUrl,
} from "./database-errors.js";
import {
  buildPostgresUrl,
  checkPostgresConnection,
  connectToPostgres,
} from "./postgres-database.js";
import {
  buildMysqlUrl,
  openMysqlDatabase,
  WrongDatabaseCollationError,
} from "./dialect/mysql-database.js";

/**
 * How the database in use was picked:
 * - "environment": DATABASE_URL is set, so setup can't change it;
 * - "setup": chosen on the setup screen and saved in .lintel/config.json;
 * - "default": nothing chosen yet, so the built-in database is running.
 */
export type DatabaseChosenBy = "environment" | "setup" | "default";

/**
 * The database the server is using right now. The setup screen can switch it while the
 * server runs, so routes read `server.database` on every request instead of keeping it.
 */
export class ActiveDatabase {
  #opened: OpenedDatabase;
  #chosenBy: DatabaseChosenBy;
  #pluginMigrations: readonly PluginMigrations[] = [];

  constructor(opened: OpenedDatabase, chosenBy: DatabaseChosenBy) {
    this.#opened = opened;
    this.#chosenBy = chosenBy;
  }

  get database(): Database {
    return this.#opened.database;
  }

  get kind(): DatabaseKind {
    return this.#opened.kind;
  }

  get chosenBy(): DatabaseChosenBy {
    return this.#chosenBy;
  }

  /**
   * Brings the installed plugins' tables up to date now, and in any database switched to
   * later. The server calls this once its plugins are known (see `buildServer`).
   */
  async applyPluginMigrations(plugins: readonly PluginMigrations[]): Promise<void> {
    this.#pluginMigrations = plugins;
    await this.#opened.applyPluginMigrations(plugins);
  }

  /** Starts using `next` and closes the previous connection once it has been swapped out. */
  async switchTo(next: OpenedDatabase, chosenBy: DatabaseChosenBy): Promise<void> {
    if (next !== this.#opened) {
      await next.applyPluginMigrations(this.#pluginMigrations);
    }
    const previous = this.#opened;
    this.#opened = next;
    this.#chosenBy = chosenBy;
    if (previous !== next) {
      await previous.close();
    }
  }

  /** For a choice that keeps the database already in use, such as "built-in" again. */
  recordChosenBy(chosenBy: DatabaseChosenBy): void {
    this.#chosenBy = chosenBy;
  }

  close(): Promise<void> {
    return this.#opened.close();
  }
}

/** A connection problem explained in plain English, with which kind of problem it is. */
export class DatabaseConnectionError extends Error {
  readonly problem: DatabaseProblem;

  constructor(described: DescribedDatabaseError) {
    super(described.message);
    this.name = "DatabaseConnectionError";
    this.problem = described.problem;
  }
}

export interface StartupDatabaseOptions {
  databaseUrl: string | undefined;
  lintelFolder: LintelFolder;
}

/**
 * Opens the database to start with, in this order: DATABASE_URL, the choice saved by the
 * setup screen, then the built-in database. Its tables are brought up to date before it
 * is returned, so nobody has to run migrations by hand.
 */
export async function openStartupDatabase(
  options: StartupDatabaseOptions,
): Promise<ActiveDatabase> {
  if (options.databaseUrl) {
    const target = targetFromUrl(options.databaseUrl);
    const opened = isMysqlUrl(options.databaseUrl)
      ? await openMysqlChecked(options.databaseUrl, target, "environment")
      : await openPostgresChecked(options.databaseUrl, target, "environment");
    return new ActiveDatabase(opened, "environment");
  }

  const savedChoice = readSavedDatabaseChoice(options.lintelFolder);
  const opened = savedChoice
    ? await openChosenDatabase(savedChoice, options.lintelFolder, "saved-setup")
    : await openMigratedBuiltInDatabase(options.lintelFolder);
  return new ActiveDatabase(opened, savedChoice ? "setup" : "default");
}

/** Opens and migrates the database described by a setup choice. */
export function openChosenDatabase(
  choice: DatabaseChoice,
  lintelFolder: LintelFolder,
  source: DatabaseSettingsSource,
): Promise<OpenedDatabase> {
  if (choice.kind === "built-in") {
    return openMigratedBuiltInDatabase(lintelFolder);
  }
  if (choice.kind === "mysql") {
    return openMysqlChecked(buildMysqlUrl(choice), choice, source);
  }
  return openPostgresChecked(buildPostgresUrl(choice), choice, source);
}

/** One line for the terminal saying which database is in use. */
export function describeActiveDatabase(activeDatabase: ActiveDatabase): string {
  if (activeDatabase.kind === "mysql") {
    return activeDatabase.chosenBy === "environment"
      ? "Using the MySQL or MariaDB database in DATABASE_URL."
      : "Using the MySQL or MariaDB database chosen during setup (saved in .lintel/config.json).";
  }
  if (activeDatabase.chosenBy === "environment") {
    return "Using the Postgres database in DATABASE_URL.";
  }
  if (activeDatabase.kind === "postgres") {
    return "Using the Postgres database chosen during setup (saved in .lintel/config.json).";
  }
  return "Using the built-in database (stored in the Lintel folder, .lintel unless LINTEL_FOLDER says otherwise). Set DATABASE_URL to use your own Postgres.";
}

async function openMigratedBuiltInDatabase(lintelFolder: LintelFolder): Promise<OpenedDatabase> {
  const opened = await openBuiltInDatabase({ dataFolder: lintelFolder.dataFolder });
  try {
    await opened.applyMigrations();
    return opened;
  } catch (error) {
    await opened.close();
    throw error;
  }
}

async function openMysqlChecked(
  databaseUrl: string,
  target: DatabaseTarget,
  source: DatabaseSettingsSource,
): Promise<OpenedDatabase> {
  const mysqlTarget: DatabaseTarget = { ...target, kind: "mysql" };
  let opened: OpenedDatabase | undefined;
  try {
    opened = await openMysqlDatabase(databaseUrl);
    await opened.applyMigrations();
    return opened;
  } catch (error) {
    await opened?.close();
    if (error instanceof WrongDatabaseCollationError) {
      throw new DatabaseConnectionError({ problem: "invalid", message: error.message });
    }
    const described = describeDatabaseError(error, mysqlTarget, source);
    throw described ? new DatabaseConnectionError(described) : error;
  }
}

async function openPostgresChecked(
  databaseUrl: string,
  target: DatabaseTarget,
  source: DatabaseSettingsSource,
): Promise<OpenedDatabase> {
  const opened = connectToPostgres(databaseUrl);
  try {
    await checkPostgresConnection(databaseUrl);
    await opened.applyMigrations();
    return opened;
  } catch (error) {
    await opened.close();
    const described = describeDatabaseError(error, target, source);
    throw described ? new DatabaseConnectionError(described) : error;
  }
}
