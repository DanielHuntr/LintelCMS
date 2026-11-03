#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runCronCommand } from "./cron-command.js";
import { runDoctorCommand } from "./doctor-command.js";
import { PUBLISH_USAGE, runPublishCommand } from "./publish-command.js";

/**
 * `lintel <command>`: the commands people run on a server. In the repository it is
 * `pnpm lintel <command>`; in the shared-hosting package, `node lintel.js <command>` (or a
 * package.json script, which cPanel's "Run JS script" button runs).
 *
 * Each command returns its exit code: 0 when all is well, 1 when something needs doing.
 */
const USAGE = `Usage: lintel <command>

  cron                  Run the scheduled jobs now, through the running website
  cron --print-line     Print the line to paste into your host's Cron Jobs screen
  doctor                Check Lintel's settings and data folder
  doctor --hosting      Also check this server can run Lintel (Node.js, memory, images...)
${PUBLISH_USAGE}
`;

export async function runCommandLine(argumentsGiven: readonly string[]): Promise<number> {
  const [command, ...rest] = argumentsGiven;
  switch (command) {
    case "cron":
      return runCronCommand(rest);
    case "doctor":
      return runDoctorCommand(rest);
    case "publish":
    case "export":
      return runPublishCommand(command, rest);
    case undefined:
    case "help":
    case "--help":
      process.stdout.write(USAGE);
      return 0;
    default:
      process.stderr.write(`There is no "${command}" command.\n\n${USAGE}`);
      return 1;
  }
}

// Run as a program (`tsx src/cli/lintel.ts`, `node dist/cli/lintel.js`), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCommandLine(process.argv.slice(2));
}
