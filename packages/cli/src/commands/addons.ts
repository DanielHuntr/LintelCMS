import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addonsFolderIn,
  lintelPaths,
  loadConfig,
  loadProjectEnvFile,
} from "@lintel/core/data-tools";
import { lintelVersion } from "@lintel/core/updates";
import { buildAddon } from "../addons/addon-build.js";
import {
  addAddon,
  type AddonsContext,
  linkAddon,
  listAddons,
  type NpmRunner,
  removeAddon,
  runNpm,
  unlinkAddon,
} from "../addons/addon-install.js";
import { scaffoldAddon } from "../addons/addon-scaffold.js";
import { type Command, readArguments } from "../command.js";
import { CommandError, resolvePath, type Terminal } from "../terminal.js";

const usage = [
  "Usage: pnpm lintel addons <command>",
  "  add <package> [--off]     install an add-on from npm (or a folder or .tgz) and switch it on",
  "  remove <package or id>    uninstall it; anything it saved is kept",
  "  list                      the installed add-ons, and whether they work with this Lintel",
  "  new <name> [--folder <path>]  start a new add-on, with an example of each part",
  "  build [--watch]           bundle the add-on in this folder for Lintel to load",
  "  link <folder>             use an add-on straight from a folder you're working on",
  "  unlink <folder or id>     stop using a linked add-on",
].join("\n");

export interface AddonsCommandOptions {
  npm?: NpmRunner;
  /** The add-ons folder; defaults to the one in the Lintel folder (LINTEL_FOLDER). */
  folder?: () => string;
}

function defaultFolder(): string {
  loadProjectEnvFile();
  return addonsFolderIn(lintelPaths(loadConfig()).root);
}

export function makeAddonsCommand(options: AddonsCommandOptions = {}): Command {
  return {
    name: "addons",
    summary: "Add-ons: add, remove and list them, or build your own (new, build, link)",
    usage,
    async run(argumentList, terminal) {
      const { values, positionals } = readArguments(
        argumentList,
        {
          off: { type: "boolean", default: false },
          watch: { type: "boolean", default: false },
          folder: { type: "string" },
        },
        usage,
      );
      const [subcommand, target] = positionals;
      const context = (): AddonsContext => ({
        folder: (options.folder ?? defaultFolder)(),
        lintelVersion: lintelVersion(),
        npm: options.npm ?? runNpm,
        terminal,
      });
      switch (subcommand) {
        case "add":
          await addAddon(context(), required(target, "add <package>"), { switchOn: !values.off });
          return 0;
        case "remove":
          await removeAddon(context(), required(target, "remove <package or id>"));
          return 0;
        case "list":
          await listAddons(context());
          return 0;
        case "link":
          await linkAddon(context(), resolvePath(terminal, required(target, "link <folder>")));
          return 0;
        case "unlink": {
          const name = required(target, "unlink <folder or id>");
          await unlinkAddon(context(), /[\\/]/.test(name) ? resolvePath(terminal, name) : name);
          return 0;
        }
        case "build":
          return build(terminal, values.watch);
        case "new":
          await scaffoldAddon({
            name: required(target, "new <name>"),
            folder: values.folder ? resolvePath(terminal, values.folder) : undefined,
            terminal,
          });
          return 0;
        default:
          throw new CommandError(usage);
      }
    },
  };
}

export const addonsCommand = makeAddonsCommand();

async function build(terminal: Terminal, watch: boolean): Promise<number> {
  const built = await buildAddon(addonFolderToBuild(terminal), { watch, terminal });
  if (watch) {
    // Keeps going until the person stops it.
    await new Promise<void>((resolve) => process.once("SIGINT", resolve));
    await built.stop();
  }
  return 0;
}

/**
 * The add-on to build: the folder npm or pnpm runs the add-on's own script in, else where
 * the person ran the command (`pnpm lintel` itself runs in packages/cli).
 */
function addonFolderToBuild(terminal: Terminal): string {
  const packageFile = join(process.cwd(), "package.json");
  if (existsSync(packageFile) && readFileSync(packageFile, "utf8").includes('"lintel-addon"')) {
    return process.cwd();
  }
  return terminal.workingFolder;
}

function required(value: string | undefined, shape: string): string {
  if (!value) throw new CommandError(`Say which: lintel addons ${shape}`);
  return value;
}
