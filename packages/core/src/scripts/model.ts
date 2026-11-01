import { isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { loadConfig, loadProjectEnvFile } from "../config.js";
import {
  contentModelOptionsFromConfig,
  describePath,
  resolveFromRepository,
} from "../content-model-sync/content-model-config.js";
import { ContentModelProblemsError } from "../content-model-sync/content-model-sync.errors.js";
import { readModelFromDatabase } from "../content-model-sync/model-database.js";
import {
  checkModel,
  ContentModelFolderMissingError,
  DataLossNotAllowedError,
  describeChanges,
  diffModel,
  pullModel,
  pushModel,
  writeModelTypes,
} from "../content-model-sync/model-commands.js";
import { modelFolderExists, readModelFolder } from "../content-model-sync/model-files.js";
import { openConfiguredDatabase, runWithFriendlyErrors } from "../startup.js";

/**
 * The content model commands, until the `lintel` command line has them:
 *
 *   pnpm --filter @lintel/core model pull [--format typescript|yaml]
 *   pnpm --filter @lintel/core model push [--yes] [--allow-data-loss]
 *   pnpm --filter @lintel/core model diff [--exit-code]
 *   pnpm --filter @lintel/core model types [--out <file>] [--from files|database]
 *   pnpm --filter @lintel/core model check [--types <file>]
 *
 * Everything they do is in src/content-model-sync/model-commands.ts.
 */
const USAGE = "Usage: model <pull|push|diff|types|check> [options]. See src/scripts/README.md.";

await runWithFriendlyErrors(async () => {
  loadProjectEnvFile();
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2).filter((argument) => argument !== "--"),
    allowPositionals: true,
    options: {
      format: { type: "string" },
      yes: { type: "boolean", default: false },
      "allow-data-loss": { type: "boolean", default: false },
      "exit-code": { type: "boolean", default: false },
      out: { type: "string" },
      from: { type: "string" },
      types: { type: "string", multiple: true },
    },
  });
  const config = loadConfig();
  const options = contentModelOptionsFromConfig(config);
  const [command] = positionals;

  try {
    if (command === "check") {
      const typesFiles = (values.types ?? []).map(fromWhereRun);
      const result = await checkModel(options.folder, typesFiles);
      if (result.problems.length > 0) {
        fail(result.problems.map((problem) => `  - ${problem}`).join("\n"));
      }
      say(`The content model in ${options.folderLabel} is valid (${result.unitCount} files).`);
      return;
    }
    if (command === "types" && values.from !== "database" && modelFolderExists(options.folder)) {
      const out = values.out
        ? fromWhereRun(values.out)
        : resolveFromRepository(config.CONTENT_MODEL_TYPES_FILE);
      const changed = await writeModelTypes((await readModelFolder(options.folder)).model, out);
      say(changed ? `Wrote ${describePath(out)}.` : `${describePath(out)} is already up to date.`);
      return;
    }
    if (!["pull", "push", "diff", "types"].includes(command ?? "")) {
      fail(USAGE);
    }
    await withDatabase(config, async (database) => {
      if (command === "pull") {
        const format =
          values.format === "yaml"
            ? "yaml"
            : values.format === undefined
              ? options.format
              : "typescript";
        const result = await pullModel(database, options.folder, format);
        say(
          result.written.length + result.removed.length === 0
            ? `${options.folderLabel} already matches the database.`
            : [
                ...result.written.map((path) => `  wrote   ${describePath(path)}`),
                ...result.removed.map((path) => `  removed ${describePath(path)}`),
              ].join("\n"),
        );
      } else if (command === "diff") {
        const diff = await diffModel(database, options.folder);
        say(describeChanges(diff.changes));
        if (values["exit-code"] && diff.changes.length > 0) {
          process.exitCode = 1;
        }
      } else if (command === "push") {
        const diff = await diffModel(database, options.folder);
        say(describeChanges(diff.changes));
        if (diff.changes.length === 0) {
          return;
        }
        if (diff.changes.some((change) => change.destructive) && !values["allow-data-loss"]) {
          throw new DataLossNotAllowedError(diff.changes);
        }
        if (!values.yes && !(await confirm("Make these changes?"))) {
          return;
        }
        await pushModel(database, options.folder, { allowDataLoss: values["allow-data-loss"] });
        say("Done. The database now matches the files.");
      } else {
        const out = values.out
          ? fromWhereRun(values.out)
          : resolveFromRepository(config.CONTENT_MODEL_TYPES_FILE);
        const changed = await writeModelTypes(await readModelFromDatabase(database), out);
        say(
          changed
            ? `Wrote ${describePath(out)} from the database.`
            : `${describePath(out)} is already up to date.`,
        );
      }
    });
  } catch (error) {
    if (
      error instanceof ContentModelProblemsError ||
      error instanceof DataLossNotAllowedError ||
      error instanceof ContentModelFolderMissingError
    ) {
      console.error(`\n${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
});

async function withDatabase(
  config: ReturnType<typeof loadConfig>,
  task: (database: Awaited<ReturnType<typeof openConfiguredDatabase>>["database"]) => Promise<void>,
): Promise<void> {
  const activeDatabase = await openConfiguredDatabase(config);
  try {
    await task(activeDatabase.database);
  } finally {
    await activeDatabase.close();
  }
}

/** Paths typed on the command line are relative to where the command was run. */
function fromWhereRun(path: string): string {
  return isAbsolute(path) ? path : resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

/** Without a terminal to ask in (CI, a deploy script), --yes is needed. */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("\nNothing was changed. Add --yes to make these changes without being asked.\n");
    process.exitCode = 1;
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`\n${question} (y/N) `);
  prompt.close();
  const agreed = answer.trim().toLowerCase().startsWith("y");
  if (!agreed) {
    say("Nothing was changed.");
  }
  return agreed;
}

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}
