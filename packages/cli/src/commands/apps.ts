import { scaffoldApp } from "../apps/app-scaffold.js";
import { type Command, readArguments } from "../command.js";
import { CommandError, resolvePath } from "../terminal.js";

const usage = [
  "Usage: pnpm lintel apps <command>",
  "  new <name> [--folder <path>]  start a new app that runs on its own server, in plain Node",
  "",
  "Apps are installed in the admin, in Build → Apps. For code that runs inside Lintel",
  "itself, see lintel addons.",
].join("\n");

export const appsCommand: Command = {
  name: "apps",
  summary: "Apps: start a new one that runs on its own server (new)",
  usage,
  async run(argumentList, terminal) {
    const { values, positionals } = readArguments(
      argumentList,
      { folder: { type: "string" } },
      usage,
    );
    const [subcommand, name] = positionals;
    if (subcommand !== "new") throw new CommandError(usage);
    if (!name) throw new CommandError("Say what to call it: lintel apps new <name>");
    await scaffoldApp({
      name,
      folder: values.folder ? resolvePath(terminal, values.folder) : undefined,
      terminal,
    });
    return 0;
  },
};
