import type { ActiveDatabase } from "@lintel/core/data-tools";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

/**
 * The content model commands live in core (src/content-model-sync/model-commands.ts),
 * which this copy of Lintel may not have yet. They are loaded when `lintel model` runs,
 * and checked against the shape below, so the tool builds and its other commands work
 * either way. Only what `lintel model` uses is described here.
 */
export const CONTENT_MODEL_COMMANDS_MODULE = "@lintel/core/content-model-commands";

type Database = ActiveDatabase["database"];

/** A content model as core reads it. The tool only passes it back to core. */
export type ContentModel = unknown;

export interface ModelChange {
  summary: string;
  destructive: boolean;
  impact?: string;
}

export interface ModelDiff {
  current: ContentModel;
  target: ContentModel;
  changes: ModelChange[];
}

export type ModelFileFormat = "typescript" | "yaml";

export interface ContentModelCommands {
  pullModel(
    database: Database,
    folder: string,
    format: ModelFileFormat,
  ): Promise<{ written: string[]; removed: string[] }>;
  diffModel(database: Database, folder: string): Promise<ModelDiff>;
  pushModel(
    database: Database,
    folder: string,
    options: { allowDataLoss?: boolean },
  ): Promise<ModelDiff>;
  writeModelTypes(model: ContentModel, path: string): Promise<boolean>;
  checkModel(
    folder: string,
    typesFiles: readonly string[],
  ): Promise<{ problems: string[]; unitCount: number }>;
  describeChanges(changes: readonly ModelChange[]): string;
}

const commandNames = [
  "pullModel",
  "diffModel",
  "pushModel",
  "writeModelTypes",
  "checkModel",
  "describeChanges",
] as const satisfies ReadonlyArray<keyof ContentModelCommands>;

/** Errors from core that are already written for people to read. */
export const readableContentModelErrors = new Set([
  "ContentModelProblemsError",
  "DataLossNotAllowedError",
  "ContentModelFolderMissingError",
]);

export type LoadContentModelCommands = () => Promise<ContentModelCommands | undefined>;

/** The commands, or undefined when this copy of Lintel doesn't have them. */
export const loadContentModelCommands: LoadContentModelCommands = async () => {
  // A variable, so the compiler doesn't look for a module that may not be there.
  const specifier: string = CONTENT_MODEL_COMMANDS_MODULE;
  let loaded: unknown;
  try {
    loaded = await import(specifier);
  } catch (error) {
    if (isMissingModule(error)) {
      return undefined;
    }
    throw error;
  }
  return asContentModelCommands(loaded);
};

/** Checks a loaded module has every command, so a mismatch fails clearly, not halfway. */
export function asContentModelCommands(loaded: unknown): ContentModelCommands | undefined {
  if (typeof loaded !== "object" || loaded === null) {
    return undefined;
  }
  const exported = loaded as Record<string, unknown>;
  const complete = commandNames.every((name) => typeof exported[name] === "function");
  return complete ? (loaded as ContentModelCommands) : undefined;
}

function isMissingModule(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }
  if (error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
    return true;
  }
  // Only the commands' own file being absent counts, not a file they import.
  return (
    error.code === "ERR_MODULE_NOT_FOUND" &&
    (error.message.includes("model-commands") ||
      error.message.includes(CONTENT_MODEL_COMMANDS_MODULE))
  );
}

/** The repository root, counted from this file; the same from src and dist. */
const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export interface ContentModelSettings {
  folder: string;
  format: ModelFileFormat;
  typesFile: string;
}

/**
 * Where the model files and the types file are, from the same settings the server reads
 * (CONTENT_MODEL_FOLDER, CONTENT_MODEL_FORMAT, CONTENT_MODEL_TYPES_FILE), relative to the
 * repository root, with the server's defaults.
 */
export function contentModelSettings(
  environment: NodeJS.ProcessEnv = process.env,
): ContentModelSettings {
  return {
    folder: fromRepository(environment.CONTENT_MODEL_FOLDER || "content-model"),
    format: environment.CONTENT_MODEL_FORMAT === "yaml" ? "yaml" : "typescript",
    typesFile: fromRepository(
      environment.CONTENT_MODEL_TYPES_FILE || "generated/lintel-content.ts",
    ),
  };
}

function fromRepository(path: string): string {
  return isAbsolute(path) ? path : resolve(REPOSITORY_ROOT, path);
}
