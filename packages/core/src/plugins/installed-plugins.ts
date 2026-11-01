import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LintelConfig, LintelPlugin } from "./plugin-definition.js";

/** The repository root, where lintel.config.ts lives; the same place from `src` and `dist`. */
export const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export const CONFIG_FILE_NAME = "lintel.config.ts";

/** A plugin package listed in lintel.config.ts that couldn't be loaded. */
export class PluginPackageError extends Error {
  constructor(packageName: string, problem: string) {
    super(`The plugin package "${packageName}" in ${CONFIG_FILE_NAME} ${problem}`);
    this.name = "PluginPackageError";
  }
}

/**
 * Reads lintel.config.ts and loads the server half (`<package>/server`) of every plugin
 * package it lists. No config file means no installed plugins, only the built-in ones.
 *
 * Packages are found from the repository root, as Node finds a root dependency, so a
 * plugin is installed with `pnpm add -w <package>` and then listed in the config. The
 * `development` condition (set by `pnpm dev`) picks a workspace plugin's TypeScript source;
 * otherwise its built `dist` is used.
 */
export async function loadInstalledPlugins(root = REPOSITORY_ROOT): Promise<LintelPlugin[]> {
  const configFile = join(root, CONFIG_FILE_NAME);
  if (!existsSync(configFile)) {
    return [];
  }
  const config = await readConfig(configFile);
  const requireFromRoot = createRequire(join(root, "package.json"));
  const plugins: LintelPlugin[] = [];
  for (const packageName of config.plugins) {
    plugins.push(await loadPluginPackage(packageName, requireFromRoot));
  }
  return plugins;
}

async function readConfig(configFile: string): Promise<LintelConfig> {
  const loaded: unknown = await import(pathToFileURL(configFile).href);
  const config = (loaded as { default?: unknown }).default;
  if (!isLintelConfig(config)) {
    throw new Error(
      `${CONFIG_FILE_NAME} should export default { plugins: ["package-name", ...] }.`,
    );
  }
  return config;
}

function isLintelConfig(value: unknown): value is LintelConfig {
  if (typeof value !== "object" || value === null || !("plugins" in value)) return false;
  const { plugins } = value;
  return Array.isArray(plugins) && plugins.every((name) => typeof name === "string");
}

async function loadPluginPackage(
  packageName: string,
  requireFromRoot: NodeJS.Require,
): Promise<LintelPlugin> {
  let entry: string;
  try {
    entry = requireFromRoot.resolve(`${packageName}/server`);
  } catch {
    throw new PluginPackageError(
      packageName,
      `can't be found. Install it at the repository root (pnpm add -w ${packageName}), and check it exports "./server".`,
    );
  }
  const loaded: unknown = await import(pathToFileURL(entry).href);
  const plugin = (loaded as { default?: unknown }).default;
  if (!isPluginDefinition(plugin)) {
    throw new PluginPackageError(
      packageName,
      `should export default definePlugin({...}) from "./server".`,
    );
  }
  return plugin;
}

function isPluginDefinition(value: unknown): value is LintelPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string"
  );
}
