import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { parse as parseYaml } from "yaml";
import { type ModelUnit, type ModelUnitKind, unitKey } from "./content-model.schema.js";
import {
  ContentModelFileUnreadableError,
  ContentModelProblemsError,
} from "./content-model-sync.errors.js";
import { modelDefinitionJsonSchema } from "./model-definition.schema.js";
import {
  type LoadedDefinition,
  type ModelFromFiles,
  modelFromDefinitions,
} from "./model-from-definitions.js";
import {
  printTypeScriptFile,
  typeScriptHeader,
  CONTENT_MODEL_IMPORT,
} from "./typescript-printer.js";
import { JSON_SCHEMA_FILE_NAME, printYamlFile, yamlHeader } from "./yaml-printer.js";

/**
 * Reading and writing the content model folder. Every `.ts`, `.yaml` and `.yml` file in
 * it (and its subfolders) is read; a TypeScript file without a default export is a helper
 * other files import (shared fields, say) and is skipped. New files go in a folder per
 * kind: content-types/, taxonomies/, globals/ and menus/.
 */

export type ModelFileFormat = "typescript" | "yaml";

const KIND_FOLDERS: Record<ModelUnitKind, string> = {
  contentType: "content-types",
  taxonomy: "taxonomies",
  globalSet: "globals",
  menu: "menus",
};

const TYPESCRIPT_EXTENSIONS = [".ts", ".mts"];
const YAML_EXTENSIONS = [".yaml", ".yml"];

export interface ModelFolder extends ModelFromFiles {
  /** The absolute path of each unit's file, by unit key. */
  paths: ReadonlyMap<string, string>;
}

export function modelFolderExists(folder: string): boolean {
  return existsSync(folder);
}

/** Reads and checks every file. Throws `ContentModelProblemsError` listing what's wrong. */
export async function readModelFolder(folder: string): Promise<ModelFolder> {
  const files = await listModelFiles(folder);
  const loaded: LoadedDefinition[] = [];
  const pathsBySource = new Map<string, string>();
  const problems: string[] = [];
  const loader = createDefinitionLoader();

  for (const path of files) {
    const source = relative(folder, path).split(sep).join("/");
    try {
      const definition = await loadDefinitionFile(loader, path);
      if (definition !== undefined) {
        loaded.push({ source, definition });
        pathsBySource.set(source, path);
      }
    } catch (error) {
      const reason = error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);
      problems.push(...new ContentModelFileUnreadableError(source, reason).problems);
    }
  }
  if (problems.length > 0) {
    throw new ContentModelProblemsError(problems);
  }

  const fromFiles = modelFromDefinitions(loaded);
  const paths = new Map(
    [...fromFiles.sources].map(([key, source]) => [key, pathsBySource.get(source) ?? source]),
  );
  return { ...fromFiles, paths };
}

async function listModelFiles(folder: string): Promise<string[]> {
  if (!modelFolderExists(folder)) {
    return [];
  }
  const found: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true, recursive: true })) {
    const path = join(entry.parentPath, entry.name);
    const insideIgnored = relative(folder, path)
      .split(sep)
      .some((part) => part.startsWith(".") || part === "node_modules");
    if (entry.isFile() && !insideIgnored && isModelFile(entry.name)) {
      found.push(path);
    }
  }
  return found.sort();
}

function isModelFile(name: string): boolean {
  const extension = extname(name);
  if (name.endsWith(".d.ts")) {
    return false;
  }
  return TYPESCRIPT_EXTENSIONS.includes(extension) || YAML_EXTENSIONS.includes(extension);
}

type DefinitionLoader = ReturnType<typeof createDefinitionLoader>;

/**
 * A fresh loader for each read of the folder, without caches, so an edited file (or a
 * shared file it imports) is read again. `@lintel/core/content-model` is pointed at this package's own
 * copy, so files work wherever the folder is and whether or not Lintel is built.
 */
function createDefinitionLoader() {
  return createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
    // A file without a default export is a helper, not a definition.
    interopDefault: false,
    alias: { [CONTENT_MODEL_IMPORT]: contentModelModulePath() },
  });
}

function contentModelModulePath(): string {
  const folder = dirname(fileURLToPath(import.meta.url));
  const typescript = join(folder, "content-model.ts");
  return existsSync(typescript) ? typescript : join(folder, "content-model.js");
}

async function loadDefinitionFile(loader: DefinitionLoader, path: string): Promise<unknown> {
  if (YAML_EXTENSIONS.includes(extname(path))) {
    return parseYaml(await readFile(path, "utf8")) as unknown;
  }
  const loaded = await loader.import<Record<string, unknown>>(path);
  return loaded.default;
}

/** Where a unit's file goes when it doesn't have one yet. */
export function newUnitPath(folder: string, unit: ModelUnit, format: ModelFileFormat): string {
  const extension = format === "yaml" ? ".yaml" : ".ts";
  return join(folder, KIND_FOLDERS[unit.kind], `${unit.handle}${extension}`);
}

/**
 * Writes one unit to `path`, in the format its extension says, keeping the comments at the
 * top of the file. Returns false when the file already said exactly this.
 */
export async function writeUnitFile(
  folder: string,
  path: string,
  unit: ModelUnit,
): Promise<boolean> {
  const existing = existsSync(path) ? await readFile(path, "utf8") : undefined;
  const isYaml = YAML_EXTENSIONS.includes(extname(path));
  const text = isYaml
    ? printYamlFile(unit, schemaPathFrom(folder, path), existing ? yamlHeader(existing) : "")
    : printTypeScriptFile(unit, existing ? typeScriptHeader(existing) : "");
  if (text === existing) {
    return false;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  await (isYaml ? writeJsonSchema(folder) : writeEditorConfig(folder));
  return true;
}

/**
 * A tsconfig.json for the folder, made once, so editors resolve `@lintel/core/content-model`
 * to this package (completion, JSDoc, errors) without the folder needing a package.json.
 */
async function writeEditorConfig(folder: string): Promise<void> {
  const path = join(folder, "tsconfig.json");
  if (existsSync(path)) {
    return;
  }
  const module = contentModelModulePath();
  const types = module.endsWith(".js") ? module.replace(/\.js$/, ".d.ts") : module;
  const fromFolder = relative(folder, types).split(sep).join("/");
  const config = {
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      paths: { [CONTENT_MODEL_IMPORT]: [fromFolder] },
    },
    include: ["**/*.ts"],
  };
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

export async function deleteUnitFile(path: string): Promise<void> {
  await rm(path, { force: true });
}

function schemaPathFrom(folder: string, path: string): string {
  const fromFile = relative(dirname(path), join(folder, JSON_SCHEMA_FILE_NAME));
  const posix = fromFile.split(sep).join("/");
  return posix.startsWith(".") ? posix : `./${posix}`;
}

/** The JSON Schema YAML files point at, written next to them. */
export async function writeJsonSchema(folder: string): Promise<void> {
  const path = join(folder, JSON_SCHEMA_FILE_NAME);
  const text = `${JSON.stringify(modelDefinitionJsonSchema(), null, 2)}\n`;
  const existing = existsSync(path) ? await readFile(path, "utf8") : undefined;
  if (existing !== text) {
    await mkdir(folder, { recursive: true });
    await writeFile(path, text);
  }
}

/** The path a unit already has, or a new one. */
export function pathForUnit(
  folder: string,
  unit: ModelUnit,
  existing: ReadonlyMap<string, string>,
  format: ModelFileFormat,
): string {
  return existing.get(unitKey(unit)) ?? newUnitPath(folder, unit, format);
}
