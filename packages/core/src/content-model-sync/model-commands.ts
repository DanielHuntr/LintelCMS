import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DatabaseOrTransaction } from "../database/client.js";
import { writeSetting } from "../settings/settings.service.js";
import { applyModel } from "./apply-model.service.js";
import { type ContentModel, sortedUnits, unitKey } from "./content-model.schema.js";
import { ContentModelProblemsError } from "./content-model-sync.errors.js";
import { generateModelTypes } from "./generate-types.js";
import { readModelFromDatabase } from "./model-database.js";
import { diffModels } from "./model-diff.js";
import {
  deleteUnitFile,
  type ModelFileFormat,
  modelFolderExists,
  pathForUnit,
  readModelFolder,
  writeUnitFile,
} from "./model-files.js";
import { type AssessedChange, assessChanges } from "./model-impact.js";
import { hashUnit } from "./model-sync-plan.js";

/**
 * What the `model` commands do, as functions: the command line (src/scripts/model.ts, and
 * later `lintel model ...`) only reads arguments, opens the database and prints results.
 *
 *   pull   database → files
 *   push   files → database, after showing what will change
 *   diff   what push would change
 *   types  TypeScript types and a typed delivery client
 *   check  for CI: the files are valid and the generated types are up to date
 */

export class DataLossNotAllowedError extends Error {
  constructor(readonly changes: readonly AssessedChange[]) {
    super(
      "Nothing was changed, because some of these changes would delete content:\n" +
        changes
          .filter((change) => change.destructive)
          .map((change) => `  - ${change.impact}`)
          .join("\n") +
        "\n\nIf that's what you want, run the command again with --allow-data-loss.",
    );
    this.name = "DataLossNotAllowedError";
  }
}

export class ContentModelFolderMissingError extends Error {
  constructor(folder: string) {
    super(
      `There is no content model folder at ${folder}. Run \`model pull\` to make one from the ` +
        "database, or set CONTENT_MODEL_FOLDER to where yours is.",
    );
    this.name = "ContentModelFolderMissingError";
  }
}

export interface PullResult {
  written: string[];
  removed: string[];
}

/** Makes the folder match the database: writes every unit, removes files for ones it lacks. */
export async function pullModel(
  database: DatabaseOrTransaction,
  folder: string,
  format: ModelFileFormat,
): Promise<PullResult> {
  const fromDatabase = await readModelFromDatabase(database);
  const existing = modelFolderExists(folder) ? await readModelFolder(folder) : undefined;
  const paths = existing?.paths ?? new Map<string, string>();
  const result: PullResult = { written: [], removed: [] };

  for (const unit of sortedUnits(fromDatabase)) {
    const path = pathForUnit(folder, unit, paths, format);
    if (await writeUnitFile(folder, path, unit)) {
      result.written.push(path);
    }
  }
  for (const [key, path] of paths) {
    if (!fromDatabase.has(key)) {
      await deleteUnitFile(path);
      result.removed.push(path);
    }
  }
  await mkdir(folder, { recursive: true });
  await rememberInSync(database, fromDatabase);
  return result;
}

export interface ModelDiff {
  current: ContentModel;
  target: ContentModel;
  changes: AssessedChange[];
}

/** What `push` would change, with what each change would delete. */
export async function diffModel(
  database: DatabaseOrTransaction,
  folder: string,
): Promise<ModelDiff> {
  if (!modelFolderExists(folder)) {
    throw new ContentModelFolderMissingError(folder);
  }
  const { model: target } = await readModelFolder(folder);
  const current = await readModelFromDatabase(database);
  const changes = await assessChanges(database, diffModels(current, target));
  return { current, target, changes };
}

/** Applies the files to the database. Refuses everything if a change would delete content. */
export async function pushModel(
  database: DatabaseOrTransaction,
  folder: string,
  { allowDataLoss = false }: { allowDataLoss?: boolean } = {},
): Promise<ModelDiff> {
  const diff = await diffModel(database, folder);
  if (!allowDataLoss && diff.changes.some((change) => change.destructive)) {
    throw new DataLossNotAllowedError(diff.changes);
  }
  if (diff.changes.length > 0) {
    await applyModel(database, diff.current, diff.target);
  }
  await rememberInSync(database, diff.target);
  return diff;
}

/** After pull and push both sides agree, so development sync starts from here. */
async function rememberInSync(database: DatabaseOrTransaction, model: ContentModel): Promise<void> {
  const base: Record<string, string> = {};
  for (const unit of model.values()) {
    base[unitKey(unit)] = hashUnit(unit) ?? "";
  }
  await writeSetting(database, "contentModelSyncBase", base);
}

/** Writes the types file. Returns false when it was already up to date. */
export async function writeModelTypes(model: ContentModel, path: string): Promise<boolean> {
  const text = generateModelTypes(model);
  if (existsSync(path) && (await readFile(path, "utf8")) === text) {
    return false;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  return true;
}

export interface CheckResult {
  problems: string[];
  /** How many units the files define, for the success message. */
  unitCount: number;
}

/**
 * For CI: the files can be read and follow every rule, and each types file given is what
 * `model types` would write now. Needs no database.
 */
export async function checkModel(
  folder: string,
  typesFiles: readonly string[],
): Promise<CheckResult> {
  if (!modelFolderExists(folder)) {
    return { problems: [new ContentModelFolderMissingError(folder).message], unitCount: 0 };
  }
  let model: ContentModel;
  try {
    model = (await readModelFolder(folder)).model;
  } catch (error) {
    if (error instanceof ContentModelProblemsError) {
      return { problems: [...error.problems], unitCount: 0 };
    }
    throw error;
  }
  const expected = generateModelTypes(model);
  const problems: string[] = [];
  for (const path of typesFiles) {
    const actual = existsSync(path) ? await readFile(path, "utf8") : undefined;
    if (actual === undefined) {
      problems.push(`${path} doesn't exist. Run \`model types\` to make it.`);
    } else if (withoutWhitespace(actual) !== withoutWhitespace(expected)) {
      problems.push(
        `${path} is out of date with the content model. Run \`model types\` and commit it.`,
      );
    }
  }
  return { problems, unitCount: model.size };
}

/** Formatting tools may rewrap the file; only a change in what it says counts. */
function withoutWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

/** The changes as lines of text, destructive ones marked, for the terminal. */
export function describeChanges(changes: readonly AssessedChange[]): string {
  if (changes.length === 0) {
    return "The database already matches the files. Nothing to change.";
  }
  return changes
    .map((change) => {
      const marker = change.destructive ? "!" : change.summary.startsWith("Add") ? "+" : "~";
      const impact = change.impact ? `\n      ${change.impact}` : "";
      return `  ${marker} ${change.summary}${impact}`;
    })
    .join("\n");
}
