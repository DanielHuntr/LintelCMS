import { existsSync } from "node:fs";
import {
  commandLineSources,
  type CommandLineSource,
  defaultImportsFolder,
  importFromFiles,
  loadConfig,
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
const usage = [
  "Usage: pnpm lintel import <export.zip|export.json> [--strategy skip|overwrite] [--dry-run]",
  "       pnpm lintel import <wordpress|webflow|framer|statamic|umbraco> <file|url>... [--dry-run] [--as <email>]",
].join("\n");

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
  summary: "Import a Lintel export, or move a site from another system (--dry-run to preview)",
  usage,
  async run(argumentList, terminal) {
    const { values, positionals } = readArguments(
      argumentList,
      {
        strategy: { type: "string", default: "skip" },
        "dry-run": { type: "boolean" },
        as: { type: "string" },
      },
      usage,
    );
    const [file, ...more] = positionals;
    if (file && (commandLineSources as readonly string[]).includes(file)) {
      return moveSite(terminal, file as CommandLineSource, more, {
        dryRun: values["dry-run"] ?? false,
        asEmail: values.as,
      });
    }
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

/**
 * `lintel import wordpress export.xml [wp-content.zip]` and the like: the importers behind
 * Settings → Import, with the mapping they suggest. Addresses (https://...) are downloaded.
 */
async function moveSite(
  terminal: Terminal,
  source: CommandLineSource,
  inputs: string[],
  options: { dryRun: boolean; asEmail: string | undefined },
): Promise<number> {
  if (inputs.length === 0) {
    throw new CommandError(`Which files? Give the export's path or address.\n\n${usage}`);
  }
  const paths = inputs.map((input) =>
    /^https?:\/\//i.test(input) ? input : resolvePath(terminal, input),
  );
  return withDatabase(async (activeDatabase) => {
    const config = loadConfig();
    terminal.say(options.dryRun ? "Checking what would come in..." : "Importing...");
    const result = await importFromFiles({
      database: activeDatabase.database,
      storage: defaultStorage(),
      importsFolder: defaultImportsFolder(),
      publicApiUrl: config.API_PUBLIC_URL ?? `http://localhost:${config.API_PORT}`,
      source,
      inputs: paths,
      dryRun: options.dryRun,
      asEmail: options.asEmail,
    });
    const verb = options.dryRun ? "Would bring in" : "Brought in";
    const rows = result.counts
      .filter(([, done, skipped, failed]) => done + skipped + failed > 0)
      .map(([kind, done, skipped, failed]) => [
        kind,
        String(done),
        String(skipped),
        String(failed),
      ]);
    for (const line of formatTable([["", verb, "Left out", "Problems"], ...rows])) {
      terminal.say(`  ${line}`);
    }
    for (const problem of result.problems) terminal.warn(`Problem: ${problem}`);
    for (const note of result.notes) terminal.warn(`Note: ${note}`);
    if (result.redirectsSuggested > 0) {
      terminal.say(
        `${result.redirectsSuggested} redirects from old addresses are waiting in Settings → Redirects.`,
      );
    }
    terminal.say(options.dryRun ? "Nothing was changed (dry run)." : "Import finished.");
    return 0;
  });
}
