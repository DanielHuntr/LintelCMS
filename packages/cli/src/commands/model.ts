import { loadProjectEnvFile } from "@lintel/core/data-tools";
import { relative } from "node:path";
import { type Command, readArguments, withDatabase } from "../command.js";
import {
  type ContentModelCommands,
  type ContentModelSettings,
  contentModelSettings,
  type LoadContentModelCommands,
  loadContentModelCommands,
  readableContentModelErrors,
} from "../content-model/content-model-commands.js";
import { CommandError, resolvePath, type Terminal } from "../terminal.js";

/**
 * Keeps the content model (collections, blueprints, taxonomies, globals) in files next to
 * the code, so it can be reviewed and deployed like code:
 *
 *   pull   database → files
 *   push   files → database, after showing what will change
 *   diff   what push would change
 *   types  TypeScript types for the content, for the website's code
 *   check  for CI: the files are valid and the types file is up to date
 *
 * What each one does is in core; this reads the options and prints the result.
 */
const usage = [
  "Usage: pnpm lintel model <pull|push|diff|types|check> [options]",
  "  pull   [--format typescript|yaml]",
  "  push   [--yes] [--allow-data-loss]",
  "  diff   [--exit-code]",
  "  types  [--out <file>] [--from files|database]",
  "  check  [--types <file>]",
].join("\n");

const options = {
  format: { type: "string" },
  yes: { type: "boolean", short: "y" },
  "allow-data-loss": { type: "boolean" },
  "exit-code": { type: "boolean" },
  out: { type: "string" },
  from: { type: "string" },
  types: { type: "string", multiple: true },
} as const;

type Values = ReturnType<typeof readArguments<typeof options>>["values"];

interface ModelRun {
  commands: ContentModelCommands;
  settings: ContentModelSettings;
  values: Values;
  terminal: Terminal;
}

export function makeModelCommand(load: LoadContentModelCommands): Command {
  return {
    name: "model",
    summary: "Keep the content model in files: pull, push, diff, types, check",
    usage,
    async run(argumentList, terminal) {
      const { positionals, values } = readArguments(argumentList, options, usage);
      const [subcommand] = positionals;
      if (!subcommand || !["pull", "push", "diff", "types", "check"].includes(subcommand)) {
        throw new CommandError(usage);
      }
      const commands = await load();
      if (!commands) {
        throw new CommandError(
          "This copy of Lintel doesn't have the content model commands yet. Update Lintel to use lintel model.",
        );
      }
      loadProjectEnvFile();
      const run = { commands, settings: contentModelSettings(), values, terminal };
      try {
        return await runSubcommand(subcommand, run);
      } catch (error) {
        if (error instanceof Error && readableContentModelErrors.has(error.name)) {
          throw new CommandError(error.message);
        }
        throw error;
      }
    },
  };
}

export const modelCommand = makeModelCommand(loadContentModelCommands);

async function runSubcommand(subcommand: string, run: ModelRun): Promise<number> {
  const { commands, settings, values, terminal } = run;
  if (subcommand === "check") {
    const typesFiles = (values.types ?? []).map((path) => resolvePath(terminal, path));
    const result = await commands.checkModel(settings.folder, typesFiles);
    if (result.problems.length > 0) {
      throw new CommandError(result.problems.map((problem) => `  - ${problem}`).join("\n"));
    }
    terminal.say(
      `The content model in ${shown(terminal, settings.folder)} is valid (${result.unitCount} files).`,
    );
    return 0;
  }
  return withDatabase(async ({ database }) => {
    if (subcommand === "pull") {
      return pull(run, database);
    }
    if (subcommand === "types") {
      const out = values.out ? resolvePath(terminal, values.out) : settings.typesFile;
      const diff = await commands.diffModel(database, settings.folder);
      const fromDatabase = values.from === "database";
      const changed = await commands.writeModelTypes(
        fromDatabase ? diff.current : diff.target,
        out,
      );
      terminal.say(
        changed
          ? `Wrote ${shown(terminal, out)}.`
          : `${shown(terminal, out)} is already up to date.`,
      );
      return 0;
    }
    const diff = await commands.diffModel(database, settings.folder);
    terminal.say(commands.describeChanges(diff.changes));
    if (subcommand === "diff") {
      return values["exit-code"] && diff.changes.length > 0 ? 1 : 0;
    }
    if (diff.changes.length === 0) {
      return 0;
    }
    if (diff.changes.some((change) => change.destructive) && !values["allow-data-loss"]) {
      throw new CommandError(
        "Nothing was changed, because some of these changes would delete content. " +
          "If that's what you want, run the command again with --allow-data-loss.",
      );
    }
    if (!values.yes && !(await agrees(terminal))) {
      terminal.say("Nothing was changed.");
      return 1;
    }
    await commands.pushModel(database, settings.folder, {
      allowDataLoss: values["allow-data-loss"] ?? false,
    });
    terminal.say("Done. The database now matches the files.");
    return 0;
  });
}

async function pull(run: ModelRun, database: Parameters<ContentModelCommands["pullModel"]>[0]) {
  const { commands, settings, values, terminal } = run;
  if (values.format !== undefined && values.format !== "typescript" && values.format !== "yaml") {
    throw new CommandError("--format should be typescript or yaml.");
  }
  const format = values.format ?? settings.format;
  const result = await commands.pullModel(database, settings.folder, format);
  if (result.written.length + result.removed.length === 0) {
    terminal.say(`${shown(terminal, settings.folder)} already matches the database.`);
  }
  for (const path of result.written) {
    terminal.say(`  wrote   ${shown(terminal, path)}`);
  }
  for (const path of result.removed) {
    terminal.say(`  removed ${shown(terminal, path)}`);
  }
  return 0;
}

async function agrees(terminal: Terminal): Promise<boolean> {
  const answer = await terminal.ask("\nMake these changes? (y/N) ");
  return answer.trim().toLowerCase().startsWith("y");
}

/** Paths relative to where the person ran the command, when they are inside it. */
function shown(terminal: Terminal, path: string): string {
  const fromHere = relative(terminal.workingFolder, path);
  return fromHere.startsWith("..") ? path : fromHere;
}
