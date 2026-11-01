import { join } from "node:path";
import {
  BackgroundTasks,
  DataFolderInUseError,
  defaultBackupsFolder,
  makeBackup,
} from "@lintel/core/data-tools";
import { lintelVersion, REPOSITORY_ROOT } from "@lintel/core/updates";
import { type Command, defaultStorage, readArguments, withDatabase } from "../command.js";
import { CommandError } from "../terminal.js";
import { runCommand, updateFromGit } from "../updating/git-update.js";

/**
 * Updates a copy of Lintel run from a git clone. Installs started with `lintel start`
 * update from Settings → Updates instead; Docker installs with their two commands.
 */
const usage = "Usage: pnpm lintel update [--to <version>] [--branch <name>]";

export const updateCommand: Command = {
  name: "update",
  summary: "Update a copy run from source (git) to the newest release",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(
      argumentList,
      { to: { type: "string" }, branch: { type: "string" } },
      usage,
    );
    return updateFromGit({
      repositoryFolder: REPOSITORY_ROOT,
      currentVersion: lintelVersion(),
      toVersion: values.to,
      branch: values.branch,
      run: runCommand,
      makeBackup: backUpBeforeUpdating,
      terminal,
    });
  },
};

async function backUpBeforeUpdating(): Promise<string> {
  try {
    return await withDatabase(async (activeDatabase) => {
      const tasks = new BackgroundTasks(() => undefined);
      const row = await makeBackup(
        {
          database: activeDatabase.database,
          databaseKind: activeDatabase.kind,
          storage: defaultStorage(),
          folder: defaultBackupsFolder(),
          tasks,
        },
        "before-update",
        "lintel update",
      );
      return join(defaultBackupsFolder(), row.filename);
    });
  } catch (error) {
    if (error instanceof DataFolderInUseError) {
      throw new CommandError(
        "Lintel is running (pnpm dev or pnpm start), so its database can't be backed up. " +
          "Stop it, run `pnpm lintel update` again, then start it.",
      );
    }
    throw error;
  }
}
