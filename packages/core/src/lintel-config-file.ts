import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The optional `lintel.config.json` at the repository root, for settings an agency bakes
 * into every copy it deploys, such as its branding (see src/branding). Set
 * LINTEL_CONFIG_FILE to read one from somewhere else.
 *
 * Unlike .env, it can hold nested settings and point at files (a logo, say) by a path
 * relative to itself.
 */
export interface LintelConfigFile {
  /** The parsed JSON, checked section by section by the features that own each one. */
  contents: Record<string, unknown>;
  /** The folder the file is in, for resolving relative paths inside it. */
  folder: string;
}

const DEFAULT_CONFIG_FILE = fileURLToPath(new URL("../../../lintel.config.json", import.meta.url));

export class ConfigFileError extends Error {
  constructor(path: string, problem: string) {
    super(`Lintel can't start because ${path} has a problem: ${problem}`);
    this.name = "ConfigFileError";
  }
}

export function readLintelConfigFile(
  environment: NodeJS.ProcessEnv = process.env,
): LintelConfigFile {
  const path = resolve(environment.LINTEL_CONFIG_FILE || DEFAULT_CONFIG_FILE);
  if (!existsSync(path)) {
    if (environment.LINTEL_CONFIG_FILE) {
      throw new ConfigFileError(path, "the file isn't there. Check LINTEL_CONFIG_FILE.");
    }
    return { contents: {}, folder: dirname(path) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ConfigFileError(path, `it isn't valid JSON (${(error as Error).message}).`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ConfigFileError(path, 'it should hold one JSON object, like { "branding": {} }.');
  }
  return { contents: parsed as Record<string, unknown>, folder: dirname(path) };
}
