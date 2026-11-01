import { HttpError } from "@lintel/core/data-tools";
import type { Command } from "./command.js";
import { backupCommand } from "./commands/backup.js";
import { createAdminCommand } from "./commands/create-admin.js";
import { doctorCommand } from "./commands/doctor.js";
import { exportCommand } from "./commands/export.js";
import { importCommand } from "./commands/import.js";
import { migrateCommand } from "./commands/migrate.js";
import { modelCommand } from "./commands/model.js";
import { restoreCommand } from "./commands/restore.js";
import { CommandError, formatTable, type Terminal } from "./terminal.js";

/**
 * `lintel <command>`: run from the repository root as `pnpm lintel <command>`. Every
 * command is in this one list, in the order `lintel help` shows them.
 */
export const commands: readonly Command[] = [
  doctorCommand,
  backupCommand,
  restoreCommand,
  exportCommand,
  importCommand,
  migrateCommand,
  modelCommand,
  createAdminCommand,
];

export function printHelp(terminal: Terminal) {
  terminal.say("Lintel's command line tool. Run commands from the folder Lintel is in:");
  terminal.say();
  terminal.say("  pnpm lintel <command> [options]");
  terminal.say();
  for (const line of formatTable(commands.map((command) => [command.name, command.summary]))) {
    terminal.say(`  ${line}`);
  }
  terminal.say();
  terminal.say("Add --help after a command to see its options.");
}

export async function runCommandLine(argumentList: string[], terminal: Terminal): Promise<number> {
  const [name, ...rest] = argumentList.filter((argument) => argument !== "--");
  if (!name || name === "help" || name === "--help" || name === "-h") {
    printHelp(terminal);
    return 0;
  }
  const command = commands.find((candidate) => candidate.name === name);
  if (!command) {
    terminal.warn(`There is no "${name}" command.`);
    terminal.say();
    printHelp(terminal);
    return 1;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    terminal.say(command.summary);
    terminal.say(command.usage);
    return 0;
  }
  try {
    return await command.run(rest, terminal);
  } catch (error) {
    // Named errors from core (a damaged backup, a file that isn't an export) and our own
    // are for people to read; anything else is a bug and keeps its stack trace.
    if (error instanceof CommandError || error instanceof HttpError) {
      terminal.warn(error.message);
      return 1;
    }
    throw error;
  }
}
