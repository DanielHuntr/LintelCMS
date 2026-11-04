import { runCommandLine as runServerCommand } from "@lintel/core/server-commands";
import type { Command } from "../command.js";

/**
 * The commands people run on a server: they live in core, because the shared-hosting package
 * has them without this tool. `pnpm lintel` passes them on, so one command reaches them all.
 */
function passedOn(name: string, summary: string, usage: string): Command {
  return { name, summary, usage, run: (argumentList) => runServerCommand([name, ...argumentList]) };
}

export const cronCommand = passedOn(
  "cron",
  "Run the scheduled jobs now, through the running website",
  "Usage: pnpm lintel cron [--print-line]",
);

export const checkCommand = passedOn(
  "check",
  "Check this server: Node.js, the database, memory, folders, internet",
  "Usage: pnpm lintel check",
);

export const publishCommand = passedOn(
  "publish",
  "Publish the website as files to its destinations",
  'Usage: pnpm lintel publish [--target "<name>"] [--dry-run] [--confirm-deletions]',
);

/** `doctor --hosting` and `export --out <folder>` are the server's versions of those two. */
export function serverVersionOf(name: string, argumentList: string[]): Promise<number> {
  return runServerCommand([name, ...argumentList]);
}
