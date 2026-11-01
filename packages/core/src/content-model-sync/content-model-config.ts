import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../config.js";
import type { ContentModelOptions } from "./model-sync.service.js";

/** The repository root; the same place from `src` and `dist`. */
export const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** A path from the settings, which may be relative to the repository root. */
export function resolveFromRepository(path: string): string {
  return isAbsolute(path) ? path : resolve(REPOSITORY_ROOT, path);
}

/** How a path is shown to people: relative to the repository when it is inside it. */
export function describePath(path: string): string {
  const fromRoot = relative(REPOSITORY_ROOT, path);
  return fromRoot.startsWith("..") || isAbsolute(fromRoot) ? path : fromRoot.split("\\").join("/");
}

/**
 * The content model settings, from CONTENT_MODEL_FOLDER, CONTENT_MODEL_FORMAT and
 * CONTENT_MODEL_EDITABLE_IN_ADMIN. `contentModel.editableInAdmin` is on in development and
 * off everywhere else unless set.
 */
export function contentModelOptionsFromConfig(config: Config): ContentModelOptions {
  const folder = resolveFromRepository(config.CONTENT_MODEL_FOLDER);
  const isDevelopment = config.NODE_ENV === "development";
  return {
    folder,
    folderLabel: describePath(folder),
    mode: isDevelopment ? "development" : "production",
    editableInAdmin: config.CONTENT_MODEL_EDITABLE_IN_ADMIN ?? isDevelopment,
    format: config.CONTENT_MODEL_FORMAT,
  };
}
