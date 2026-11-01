import { parseArgs, type ParseArgsConfig } from "node:util";
import {
  type ActiveDatabase,
  loadConfig,
  loadProjectEnvFile,
  LocalDiskStorage,
  openConfiguredDatabase,
} from "@lintel/core/data-tools";
import { CommandError, type Terminal } from "./terminal.js";

/** One `lintel <name>` command. `run` returns the exit code: 0 when all went well. */
export interface Command {
  name: string;
  summary: string;
  usage: string;
  run(argumentList: string[], terminal: Terminal): Promise<number>;
}

type Options = NonNullable<ParseArgsConfig["options"]>;

/** Reads flags and positional arguments, turning a mistake into a message with the usage. */
export function readArguments<Config extends Options>(
  argumentList: string[],
  options: Config,
  usage: string,
) {
  try {
    return parseArgs({
      // pnpm passes a lone "--" through when people write `lintel backup -- --output ...`.
      args: argumentList.filter((argument) => argument !== "--"),
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CommandError(`${reason}\n\n${usage}`);
  }
}

/**
 * Opens the database the server uses (DATABASE_URL, the setup screen's choice or the
 * built-in one), bringing its tables up to date, and closes it afterwards.
 */
export async function withDatabase<Result>(
  task: (database: ActiveDatabase) => Promise<Result>,
): Promise<Result> {
  loadProjectEnvFile();
  const activeDatabase = await openConfiguredDatabase(loadConfig());
  try {
    return await task(activeDatabase);
  } finally {
    await activeDatabase.close();
  }
}

/** The uploads folder the server uses by default. Other storage drivers are set up in code. */
export function defaultStorage(): LocalDiskStorage {
  return new LocalDiskStorage();
}
