import { existsSync } from "node:fs";
import {
  conflictStrategies,
  type ConflictStrategy,
  type ImportPlan,
  openImportSource,
  previewImport,
  runImport,
} from "@lintel/core/data-tools";
import { type Command, defaultStorage, readArguments, withDatabase } from "../command.js";
import { CommandError, formatTable, resolvePath, type Terminal } from "../terminal.js";

/**
 * Imports a Lintel export. Running it twice changes nothing new: things are found by id
 * and handle. --strategy says what happens to things this site already has: "skip" keeps
 * them as they are (the default), "overwrite" replaces them with the export's version.
 */
const usage =
  "Usage: pnpm lintel import <export.zip|export.json> [--strategy skip|overwrite] [--dry-run]";

const kindNames: Record<string, string> = {
  blueprint: "Content types",
  collection: "Collections",
  taxonomy: "Taxonomies",
  term: "Terms",
  global: "Global sets",
  menu: "Menus",
  media: "Media",
  entry: "Entries",
};

export const importCommand: Command = {
  name: "import",
  summary: "Import a Lintel export (safe to run again; --dry-run to preview)",
  usage,
  async run(argumentList, terminal) {
    const { values, positionals } = readArguments(
      argumentList,
      { strategy: { type: "string", default: "skip" }, "dry-run": { type: "boolean" } },
      usage,
    );
    const [file] = positionals;
    if (!file) {
      throw new CommandError(`Which export? Give the path to the file.\n\n${usage}`);
    }
    const strategy = values.strategy as ConflictStrategy;
    if (!conflictStrategies.includes(strategy)) {
      throw new CommandError(`--strategy should be skip or overwrite.\n\n${usage}`);
    }
    const path = resolvePath(terminal, file);
    if (!existsSync(path)) {
      throw new CommandError(`There is no file at ${path}.`);
    }

    return withDatabase(async (activeDatabase) => {
      const context = { database: activeDatabase.database, storage: defaultStorage() };
      const source = await openImportSource(path);
      try {
        const dryRun = values["dry-run"] ?? false;
        const plan = dryRun
          ? await previewImport(context, source, strategy)
          : await runImport(context, source, strategy);
        printPlan(terminal, plan, dryRun);
        return 0;
      } finally {
        source.close();
      }
    });
  },
};

export function printPlan(terminal: Terminal, plan: ImportPlan, dryRun: boolean) {
  const verb = dryRun ? "Would" : "Did";
  const rows = Object.entries(plan.totals)
    .filter(([, totals]) => totals.create + totals.update + totals.skip > 0)
    .map(([kind, totals]) => [
      kindNames[kind] ?? kind,
      String(totals.create),
      String(totals.update),
      String(totals.skip),
    ]);
  if (rows.length === 0) {
    terminal.say("The export is empty: there was nothing to import.");
  } else {
    for (const line of formatTable([
      ["", `${verb} add`, `${verb} update`, "Already here"],
      ...rows,
    ])) {
      terminal.say(`  ${line}`);
    }
  }
  for (const warning of plan.warnings) {
    terminal.warn(`Note: ${warning}`);
  }
  terminal.say(dryRun ? "Nothing was changed (dry run)." : "Import finished.");
}
