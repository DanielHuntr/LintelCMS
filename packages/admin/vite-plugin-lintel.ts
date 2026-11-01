import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";

/**
 * Writes `virtual:lintel-plugins`, the admin halves of the plugin packages listed in
 * lintel.config.ts at the repository root:
 *
 *   import plugin0 from "/…/node_modules/@acme/lintel-bookings/src/admin.tsx";
 *   export const installedAdminPlugins = [plugin0];
 *
 * So installed plugins are ordinary imports: Vite bundles them, React sees one copy of
 * itself, and a mistake in a plugin fails the build rather than the browser. Editing the
 * config file restarts the dev server so the list is read again.
 */

const MODULE_ID = "virtual:lintel-plugins";
const RESOLVED_ID = `\0${MODULE_ID}`;
const CONFIG_FILE_NAME = "lintel.config.ts";

export function lintelPlugins(repositoryRoot = resolve(import.meta.dirname, "../..")): Plugin {
  const configFile = join(repositoryRoot, CONFIG_FILE_NAME);
  return {
    name: "lintel-plugins",
    resolveId: (id) => (id === MODULE_ID ? RESOLVED_ID : undefined),
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      if (existsSync(configFile)) this.addWatchFile(configFile);
      const entries = await findAdminEntries(repositoryRoot, configFile);
      return writeRegistry(entries);
    },
    configureServer(server) {
      server.watcher.add(configFile);
      server.watcher.on("change", (changed) => {
        if (resolve(changed) === configFile) void server.restart();
      });
    },
  };
}

/** The file each listed package exports as "./admin", found from the repository root. */
export async function findAdminEntries(
  repositoryRoot: string,
  configFile = join(repositoryRoot, CONFIG_FILE_NAME),
): Promise<string[]> {
  if (!existsSync(configFile)) return [];
  const packageNames = await readPluginPackageNames(configFile);
  const requireFromRoot = createRequire(join(repositoryRoot, "package.json"));
  return packageNames.map((packageName) => {
    try {
      return requireFromRoot.resolve(`${packageName}/admin`);
    } catch {
      throw new Error(
        `The plugin package "${packageName}" in ${CONFIG_FILE_NAME} can't be found, or doesn't export "./admin". ` +
          `Install it at the repository root (pnpm add -w ${packageName}).`,
      );
    }
  });
}

export function writeRegistry(entries: readonly string[]): string {
  const imports = entries.map(
    (entry, index) => `import plugin${index} from ${JSON.stringify(entry)};`,
  );
  const list = entries.map((_entry, index) => `plugin${index}`).join(", ");
  return [...imports, `export const installedAdminPlugins = [${list}];`, ""].join("\n");
}

async function readPluginPackageNames(configFile: string): Promise<string[]> {
  // Node strips the types itself, so the config needs no build step.
  const loaded = (await import(pathToFileURL(configFile).href)) as { default?: unknown };
  const config = loaded.default;
  const plugins =
    typeof config === "object" && config !== null && "plugins" in config ? config.plugins : null;
  if (!Array.isArray(plugins) || !plugins.every((name) => typeof name === "string")) {
    throw new Error(
      `${CONFIG_FILE_NAME} should export default { plugins: ["package-name", ...] }.`,
    );
  }
  return plugins;
}
