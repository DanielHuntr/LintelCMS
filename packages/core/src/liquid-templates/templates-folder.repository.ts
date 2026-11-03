import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { TEMPLATE_NAME_PATTERN } from "./template-choice.js";

/**
 * Reading the templates folder: the one place that touches the disk for the list of page
 * templates. Liquid itself reads the files it renders (see liquid-engine.ts).
 *
 *   site/
 *     templates/<collection>.liquid   one per collection, and any a page can choose
 *     templates/pages/wide.liquid     subfolders are fine: the name is "pages/wide"
 *     layouts/*.liquid                for {% layout %}
 *     partials/*.liquid               for {% render %}
 */

export const TEMPLATES_SUBFOLDER = "templates";
export const LAYOUTS_SUBFOLDER = "layouts";
export const PARTIALS_SUBFOLDER = "partials";
export const TEMPLATE_EXTENSION = ".liquid";

/**
 * The names of the page templates in the folder ("page", "pages/wide"), sorted. None when
 * the folder (or its templates folder) doesn't exist. Files whose names couldn't be chosen
 * (spaces, capitals) are left out.
 */
export async function listTemplateNames(folder: string): Promise<string[]> {
  const templatesFolder = join(folder, TEMPLATES_SUBFOLDER);
  let files: string[];
  try {
    files = await readdir(templatesFolder, { recursive: true });
  } catch (error) {
    if (isMissingFolder(error)) return [];
    throw error;
  }
  return files
    .filter((file) => file.endsWith(TEMPLATE_EXTENSION))
    .map((file) =>
      relative(templatesFolder, join(templatesFolder, file))
        .split("\\")
        .join("/")
        .slice(0, -TEMPLATE_EXTENSION.length),
    )
    .filter((name) => TEMPLATE_NAME_PATTERN.test(name))
    .sort();
}

function isMissingFolder(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
