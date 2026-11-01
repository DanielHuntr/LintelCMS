import { existsSync } from "node:fs";
import {
  BackgroundTasks,
  DEFAULT_BACKUPS_FOLDER,
  inspectBackupArchive,
  makeBackup,
  restoreBackupArchive,
  type RestoreSummary,
} from "@lintel/core/data-tools";
import { type Command, defaultStorage, readArguments, withDatabase } from "../command.js";
import { CommandError, formatTable, plural, resolvePath, type Terminal } from "../terminal.js";

/**
 * Puts a backup back, replacing everything on this site. It is checked in full first, the
 * site as it is now is backed up into the backups folder, and only then is anything
 * replaced. --dry-run checks the backup and shows what would change, and stops there.
 */
const usage = "Usage: pnpm lintel restore <backup.zip> [--dry-run] [--yes]";

export const restoreCommand: Command = {
  name: "restore",
  summary: "Replace this site with a backup (asks first; --dry-run to check only)",
  usage,
  async run(argumentList, terminal) {
    const { values, positionals } = readArguments(
      argumentList,
      { "dry-run": { type: "boolean" }, yes: { type: "boolean", short: "y" } },
      usage,
    );
    const [file] = positionals;
    if (!file) {
      throw new CommandError(`Which backup? Give the path to its .zip file.\n\n${usage}`);
    }
    const path = resolvePath(terminal, file);
    if (!existsSync(path)) {
      throw new CommandError(`There is no file at ${path}.`);
    }
    const storage = defaultStorage();

    return withDatabase(async (activeDatabase) => {
      const context = { database: activeDatabase.database, databaseKind: activeDatabase.kind, storage };
      terminal.say("Checking the backup…");
      const summary = await inspectBackupArchive(context, path);
      printSummary(terminal, summary);

      if (values["dry-run"]) {
        terminal.say("The backup is complete and undamaged. Nothing was changed (dry run).");
        return 0;
      }
      if (!values.yes && !(await confirmRestore(terminal))) {
        terminal.say("Nothing was changed.");
        return 1;
      }

      terminal.say("Backing up the site as it is now, in case you need it back…");
      const tasks = new BackgroundTasks((error) => terminal.warn(String(error)));
      const safety = await makeBackup(
        { ...context, folder: DEFAULT_BACKUPS_FOLDER, tasks },
        "before-restore",
        "lintel restore",
      );
      terminal.say(`Saved ${safety.filename} in the backups folder.`);
      terminal.say("Restoring…");
      await restoreBackupArchive(context, path);
      terminal.say("Done. Everyone has been signed out; sign in with an account from the backup.");
      return 0;
    });
  },
};

function printSummary(terminal: Terminal, summary: RestoreSummary) {
  terminal.say(`This backup was made on ${new Date(summary.createdAt).toUTCString()}.`);
  terminal.say("Restoring it replaces what is here now:");
  const rows = summary.tables
    .filter((table) => table.inBackup > 0 || table.current > 0)
    .map((table) => [table.table, String(table.current), String(table.inBackup)]);
  for (const line of formatTable([["Table", "Here now", "In the backup"], ...rows])) {
    terminal.say(`  ${line}`);
  }
  terminal.say(`  and puts back ${plural(summary.mediaFiles, "media file")} and the site's settings.`);
}

async function confirmRestore(terminal: Terminal): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new CommandError("Restoring needs confirmation. Run it in a terminal, or add --yes.");
  }
  const answer = await terminal.ask("Type RESTORE to replace this site with the backup: ");
  return answer.trim() === "RESTORE";
}
