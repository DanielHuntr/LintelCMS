import {
  BackgroundTasks,
  DEFAULT_BACKUPS_FOLDER,
  makeBackup,
  writeBackupArchive,
} from "@lintel/core/data-tools";
import { join } from "node:path";
import { type Command, defaultStorage, readArguments, withDatabase } from "../command.js";
import { formatBytes, plural, resolvePath } from "../terminal.js";

/**
 * Backs up the whole site (database, settings and uploaded files) into one .zip. Without
 * --output it goes in the backups folder, where Settings → Backups lists it too.
 */
const usage = "Usage: pnpm lintel backup [--output <file.zip>]";

export const backupCommand: Command = {
  name: "backup",
  summary: "Back up the database, settings and media into one .zip",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(argumentList, { output: { type: "string", short: "o" } }, usage);
    const storage = defaultStorage();

    return withDatabase(async (activeDatabase) => {
      const context = { database: activeDatabase.database, databaseKind: activeDatabase.kind, storage };
      let path: string;
      let contents;
      let size;
      if (values.output) {
        path = resolvePath(terminal, values.output);
        terminal.say("Backing up…");
        ({ contents, size } = await writeBackupArchive(context, path));
      } else {
        terminal.say("Backing up into the backups folder…");
        const tasks = new BackgroundTasks((error) => terminal.warn(String(error)));
        const row = await makeBackup(
          { ...context, folder: DEFAULT_BACKUPS_FOLDER, tasks },
          "manual",
          "lintel backup",
        );
        path = join(DEFAULT_BACKUPS_FOLDER, row.filename);
        contents = row.contents;
        size = row.size;
      }

      const rows = Object.values(contents?.tables ?? {}).reduce((total, count) => total + count, 0);
      terminal.say(`Saved ${path} (${formatBytes(size ?? 0)}).`);
      terminal.say(
        `It holds ${plural(rows, "database row")} and ${plural(contents?.mediaFiles ?? 0, "media file")}.`,
      );
      for (const missing of contents?.missingMediaFiles ?? []) {
        terminal.warn(`Not included: ${missing} is in the media library but its file is missing.`);
      }
      terminal.say("Keep it somewhere safe: it holds everything, including password hashes.");
      return 0;
    });
  },
};
