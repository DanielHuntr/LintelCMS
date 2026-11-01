import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintelVersion, runSupervisor } from "@lintel/core/updates";
import { type Command, readArguments } from "../command.js";

/**
 * Runs Lintel in production under a small supervisor, which restarts it if it stops and
 * installs updates from Settings → Updates (see packages/core/src/updates/supervisor).
 * The install's home folder is LINTEL_HOME, or the folder this is run from.
 */
const usage = "Usage: pnpm lintel start [--home <folder>]";

/** The repository or release folder this command is in: packages/cli/{src,dist}/commands → root. */
const INSTALL_FOLDER = fileURLToPath(new URL("../../../../", import.meta.url));

export const startCommand: Command = {
  name: "start",
  summary: "Run Lintel on a server, with one-click updates from the admin",
  usage,
  async run(argumentList, terminal) {
    const { values } = readArguments(argumentList, { home: { type: "string" } }, usage);
    const home = resolve(
      terminal.workingFolder,
      values.home ?? process.env.LINTEL_HOME ?? terminal.workingFolder,
    );
    await runSupervisor({
      home,
      installFolder: INSTALL_FOLDER,
      installVersion: lintelVersion(),
      log: (message) => terminal.say(`[lintel] ${message}`),
    });
    // The supervisor runs until it is told to stop (SIGTERM or Ctrl+C), and exits itself.
    return new Promise<number>(() => undefined);
  },
};
