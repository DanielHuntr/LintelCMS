import { ConfigError, type Config } from "./config.js";
import {
  type ActiveDatabase,
  DatabaseConnectionError,
  openStartupDatabase,
} from "./database/active-database.js";
import { DataFolderInUseError } from "./database/data-folder-lock.js";
import { DEFAULT_LINTEL_FOLDER, SavedConfigUnreadableError } from "./database/database-choice.js";
import { PluginPackageError } from "./plugins/installed-plugins.js";
import { InvalidPluginError } from "./plugins/plugins.errors.js";

/**
 * What the server and the command-line scripts share when they start: opening the
 * configured database, and turning the problems people commonly hit into one plain
 * message instead of a stack trace.
 */

export class PortInUseError extends Error {
  constructor(port: number) {
    super(
      `Port ${port} is already in use, probably by another copy of Lintel. ` +
        "Stop that one, or set API_PORT to a different port.",
    );
    this.name = "PortInUseError";
  }
}

/** The database from DATABASE_URL, the setup screen's saved choice, or the built-in one. */
export function openConfiguredDatabase(config: Config): Promise<ActiveDatabase> {
  return openStartupDatabase({
    databaseUrl: config.DATABASE_URL,
    lintelFolder: DEFAULT_LINTEL_FOLDER,
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

function isExplained(error: unknown): error is Error {
  return (
    error instanceof ConfigError ||
    error instanceof DatabaseConnectionError ||
    error instanceof DataFolderInUseError ||
    error instanceof SavedConfigUnreadableError ||
    error instanceof PortInUseError ||
    error instanceof PluginPackageError ||
    error instanceof InvalidPluginError
  );
}
