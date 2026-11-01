import {
  countAppliedMigrations,
  DEFAULT_LINTEL_FOLDER,
  describeActiveDatabase,
  listKnownMigrations,
  loadConfig,
  loadProjectEnvFile,
  openWithoutMigrating,
} from "@lintel/core/data-tools";
import { type Command, readArguments, withDatabase } from "../command.js";
import { plural } from "../terminal.js";

/**
 * Brings the database's tables up to date. The server already does this every time it
 * starts, so this is for people who like it as a separate step (before a deploy, say).
 * --status only says how far behind the database is.
 */
const usage = "Usage: pnpm lintel migrate [--status]";

export const migrateCommand: Command = {
  name: "migrate",
  summary: "Bring the database's tables up to date (--status to only check)",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(argumentList, { status: { type: "boolean" } }, usage);
    const known = listKnownMigrations();

    if (values.status) {
      loadProjectEnvFile();
      const { opened, description } = await openWithoutMigrating(
        loadConfig().DATABASE_URL,
        DEFAULT_LINTEL_FOLDER,
      );
      try {
        const applied = await countAppliedMigrations(opened.database);
        terminal.say(`Using ${description}.`);
        terminal.say(describeStatus(applied, known.length));
        return applied === known.length ? 0 : 1;
      } finally {
        await opened.close();
      }
    }

    return withDatabase(async (activeDatabase) => {
      terminal.say(describeActiveDatabase(activeDatabase));
      terminal.say(`The database's tables are up to date (${plural(known.length, "migration")}).`);
      return 0;
    });
  },
};

export function describeStatus(applied: number, known: number): string {
  if (applied === known) {
    return `The tables are up to date (${plural(known, "migration")}).`;
  }
  if (applied > known) {
    return (
      `The database has ${plural(applied - known, "migration")} this copy of Lintel doesn't know. ` +
      "It was used by a newer Lintel: update Lintel here."
    );
  }
  return (
    `${plural(known - applied, "migration")} still to apply. ` +
    "Run pnpm lintel migrate, or just start Lintel, which applies them."
  );
}
