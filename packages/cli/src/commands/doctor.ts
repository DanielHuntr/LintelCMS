import {
  defaultBackupsFolder,
  DEFAULT_UPLOADS_FOLDER,
  listKnownMigrations,
  loadConfig,
  loadProjectEnvFile,
} from "@lintel/core/data-tools";
import { type Command, readArguments } from "../command.js";
import {
  checkDatabase,
  checkFolder,
  checkMigrations,
  checkNode,
  checkPnpm,
  checkPort,
  checkSettings,
  type CheckResult,
} from "../doctor/doctor-checks.js";
import {
  findPnpmVersion,
  probeDatabase,
  probePort,
  probeSettings,
  probeWritableFolder,
} from "../doctor/doctor-probes.js";
import type { Terminal } from "../terminal.js";
import { serverVersionOf } from "./server-commands.js";

/**
 * Checks that this machine can run Lintel and says what to do about anything that's
 * wrong: Node.js and pnpm versions, settings, the database and its tables, the folders
 * Lintel saves files in, and the ports it listens on. Changes nothing.
 */
const usage = "Usage: pnpm lintel doctor [--hosting]";

const symbols = { ok: "✓", warning: "!", problem: "✗" } as const;

export const doctorCommand: Command = {
  name: "doctor",
  summary: "Check this machine can run Lintel, with fixes for what's wrong",
  usage,
  async run(argumentList, terminal) {
    if (argumentList.includes("--hosting")) return serverVersionOf("doctor", argumentList);
    readArguments(argumentList, {}, usage);
    loadProjectEnvFile();
    terminal.say("Checking that Lintel can run here…");
    terminal.say();

    const settings = probeSettings();
    const config = settings.ok ? loadConfig() : undefined;
    const database = await probeDatabase(config?.DATABASE_URL);
    const results = [
      checkNode(process.version),
      checkPnpm(await findPnpmVersion()),
      checkSettings(settings),
      checkDatabase(database),
      checkMigrations(database, listKnownMigrations().length),
      checkFolder(
        "Media folder",
        DEFAULT_UPLOADS_FOLDER,
        await probeWritableFolder(DEFAULT_UPLOADS_FOLDER),
      ),
      checkFolder(
        "Backups folder",
        defaultBackupsFolder(),
        await probeWritableFolder(defaultBackupsFolder()),
      ),
      ...(await checkPorts(config?.API_PORT ?? 4000, config?.ADMIN_ORIGIN)),
    ].filter((result): result is CheckResult => result !== null);

    printResults(terminal, results);
    return results.some((result) => result.status === "problem") ? 1 : 0;
  },
};

async function checkPorts(apiPort: number, adminOrigin: string | undefined) {
  const results = [checkPort("the API", apiPort, await probePort(apiPort), "API_PORT")];
  const adminUrl = new URL(adminOrigin ?? "http://localhost:5173");
  if (["localhost", "127.0.0.1"].includes(adminUrl.hostname) && adminUrl.port) {
    const adminPort = Number(adminUrl.port);
    results.push(checkPort("the admin", adminPort, await probePort(adminPort), "ADMIN_ORIGIN"));
  }
  return results;
}

export function printResults(terminal: Terminal, results: readonly CheckResult[]) {
  for (const result of results) {
    terminal.say(`${symbols[result.status]} ${result.title}: ${result.detail}`);
    if (result.fix && result.status !== "ok") {
      terminal.say(`  To fix: ${result.fix}`);
    }
  }
  terminal.say();
  const problems = results.filter((result) => result.status === "problem").length;
  const warnings = results.filter((result) => result.status === "warning").length;
  if (problems > 0) {
    terminal.say(
      `${problems} ${problems === 1 ? "problem needs" : "problems need"} fixing before Lintel can run.`,
    );
  } else if (warnings > 0) {
    terminal.say("Lintel can run here. Have a look at the notes marked ! above.");
  } else {
    terminal.say("Everything looks good.");
  }
}
