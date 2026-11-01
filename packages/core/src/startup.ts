import { join, resolve } from "node:path";
import { ConfigError, type Config } from "./config.js";
import {
  type ActiveDatabase,
  DatabaseConnectionError,
  openStartupDatabase,
} from "./database/active-database.js";
import { DataFolderInUseError } from "./database/data-folder-lock.js";
import {
  DEFAULT_LINTEL_FOLDER,
  type LintelFolder,
  lintelFolderAt,
  SavedConfigUnreadableError,
} from "./database/database-choice.js";
import { PluginPackageError } from "./plugins/installed-plugins.js";
import { DataFolderNotWritableError } from "./production/data-folder.js";
import { InvalidPluginError } from "./plugins/plugins.errors.js";
import { StorageUnreachableError } from "./media/storage-driver.js";

/**
 * What the server and the command-line scripts share when they start: opening the
 * configured database, and turning the problems people commonly hit into one plain
 * message instead of a stack trace.
 */

export class PortInUseError extends Error {
  constructor(port: number, setting = "API_PORT") {
    super(
      `Port ${port} is already in use, probably by another copy of Lintel. ` +
        `Stop that one, or set ${setting} to a different port.`,
    );
    this.name = "PortInUseError";
  }
}

/** Where Lintel keeps its files on this computer. All of it lives in one folder. */
export interface LintelPaths {
  /** `.lintel` at the repository root, or LINTEL_FOLDER (the Docker image uses /data). */
  root: string;
  /** The built-in database and the setup screen's saved choice. */
  lintelFolder: LintelFolder;
  uploadsFolder: string;
  transformCacheFolder: string;
}

export function lintelPaths(config: Pick<Config, "LINTEL_FOLDER">): LintelPaths {
  const root = config.LINTEL_FOLDER
    ? resolve(config.LINTEL_FOLDER)
    : resolve(DEFAULT_LINTEL_FOLDER.dataFolder, "..");
  return {
    root,
    lintelFolder: lintelFolderAt(root),
    uploadsFolder: join(root, "uploads"),
    transformCacheFolder: join(root, "cache", "media"),
  };
}

/** The database from DATABASE_URL, the setup screen's saved choice, or the built-in one. */
export function openConfiguredDatabase(config: Config): Promise<ActiveDatabase> {
  return openStartupDatabase({
    databaseUrl: config.DATABASE_URL,
    lintelFolder: lintelPaths(config).lintelFolder,
  });
}

/**
 * Runs `task`, and if it fails with a problem we know how to explain, prints the
 * explanation and exits. Anything unexpected is a bug, so it keeps its stack trace.
 */
export async function runWithFriendlyErrors(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (isExplained(error)) {
      console.error(`\n${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

/** True for the problems Lintel explains in plain English, rather than with a stack trace. */
export function isExplained(error: unknown): error is Error {
  return (
    error instanceof DataFolderNotWritableError ||
    error instanceof ConfigError ||
    error instanceof DatabaseConnectionError ||
    error instanceof DataFolderInUseError ||
    error instanceof SavedConfigUnreadableError ||
    error instanceof PortInUseError ||
    error instanceof PluginPackageError ||
    error instanceof InvalidPluginError ||
    error instanceof StorageUnreachableError
  );
}
