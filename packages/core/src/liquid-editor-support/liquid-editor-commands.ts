import { join } from "node:path";
import { resolveFromRepository } from "../content-model-sync/content-model-config.js";
import type { ContentModel } from "../content-model-sync/content-model.schema.js";
import { readModelFromDatabase } from "../content-model-sync/model-database.js";
import { modelFolderExists, readModelFolder } from "../content-model-sync/model-files.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { fieldSnippetsForModel } from "./field-snippets.js";
import {
  FIELD_SNIPPETS_FILE,
  TAG_SNIPPETS_FILE,
  writeSnippetsFile,
} from "./snippets-file.repository.js";
import { writeStarterTemplates } from "./starter-templates.js";
import { TAG_SNIPPETS } from "./tag-snippets.js";

/**
 * What `lintel templates init|sync` does, as functions: the command line (packages/cli)
 * only reads arguments, opens the database when it must and prints the results. Imported
 * as `@lintel/core/liquid-editor-commands`.
 *
 *   init   the templates folder with a small working example, and the snippets
 *   sync   the snippets again, after the content types changed
 */

export type { ContentModel } from "../content-model-sync/content-model.schema.js";
export { SnippetsFileUnreadableError } from "./snippets-file.repository.js";
export { STARTER_TEMPLATE_FILES, type StarterTemplatesResult } from "./starter-templates.js";

export interface LiquidEditorSettings {
  /** The templates folder: LINTEL_TEMPLATES, `site/` at the repository root by default. */
  templatesFolder: string;
  /** Where VS Code looks for a project's snippets: `.vscode/` at the repository root. */
  snippetsFolder: string;
  /** CONTENT_MODEL_FOLDER, read for the fields when it exists. */
  contentModelFolder: string;
}

/** The folders, from the same settings the server reads and with its defaults. */
export function liquidEditorSettings(
  environment: NodeJS.ProcessEnv = process.env,
): LiquidEditorSettings {
  return {
    templatesFolder: resolveFromRepository(environment.LINTEL_TEMPLATES || "site"),
    snippetsFolder: resolveFromRepository(".vscode"),
    contentModelFolder: resolveFromRepository(environment.CONTENT_MODEL_FOLDER || "content-model"),
  };
}

/** Makes the templates folder with the starter files; existing files are never replaced. */
export function initTemplatesFolder(settings: LiquidEditorSettings) {
  return writeStarterTemplates(settings.templatesFolder);
}

export interface SnippetsResult {
  /** The snippets files that changed, as full paths. */
  written: string[];
  /** How many fields have snippets. */
  fieldCount: number;
}

/**
 * Writes the snippets for Lintel's tags and, given the content model, for its fields.
 * Without a model only the tags' snippets are written.
 */
export async function writeEditorSnippets(
  snippetsFolder: string,
  model: ContentModel | undefined,
): Promise<SnippetsResult> {
  const result: SnippetsResult = { written: [], fieldCount: 0 };
  const tagsPath = join(snippetsFolder, TAG_SNIPPETS_FILE);
  if (await writeSnippetsFile(tagsPath, TAG_SNIPPETS)) result.written.push(tagsPath);
  if (model) {
    const fieldSnippets = fieldSnippetsForModel(model);
    result.fieldCount = Object.keys(fieldSnippets).length;
    const fieldsPath = join(snippetsFolder, FIELD_SNIPPETS_FILE);
    if (await writeSnippetsFile(fieldsPath, fieldSnippets)) result.written.push(fieldsPath);
  }
  return result;
}

/** Whether the content model is kept in files, so the fields can be read without a database. */
export function hasContentModelFiles(settings: LiquidEditorSettings): boolean {
  return modelFolderExists(settings.contentModelFolder);
}

/** The content model from its files (see `hasContentModelFiles`). */
export async function readContentModelFiles(settings: LiquidEditorSettings): Promise<ContentModel> {
  return (await readModelFolder(settings.contentModelFolder)).model;
}

/** The content model as the database has it. */
export function readContentModelFromDatabase(
  database: DatabaseOrTransaction,
): Promise<ContentModel> {
  return readModelFromDatabase(database);
}
