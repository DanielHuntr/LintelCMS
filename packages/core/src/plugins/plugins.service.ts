import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { dialectOf } from "../database/dialect/database-dialect.js";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { PluginNeedsPostgresError, UnknownPluginError } from "./plugins.errors.js";
import type { PluginList } from "./plugins.schema.js";

/**
 * Which plugins are switched on, as saved. Only `setEnabledPlugins` writes the list, and it
 * accepts only installed plugins in catalogue order, so the list is always tidy. A plugin
 * that is later uninstalled stays in it until the list is next saved, which is harmless:
 * nothing it adds is there to show, and installing it again brings it back as it was.
 */
export async function findEnabledPluginIds(database: DatabaseOrTransaction): Promise<string[]> {
  return readSetting(database, "enabledPlugins");
}

/** Whether one plugin is switched on. */
export async function isPluginEnabled(
  database: DatabaseOrTransaction,
  pluginId: string,
): Promise<boolean> {
  return (await findEnabledPluginIds(database)).includes(pluginId);
}

/**
 * A plugin with tables of its own only runs on MySQL if it says so, by bringing migrations
 * for it: its queries were written for Postgres otherwise, and would fail or misread rows.
 */
export function canRunOn(
  database: DatabaseOrTransaction,
  plugin: Pick<LintelPlugin, "database">,
): boolean {
  if (dialectOf(database) === "postgres" || !plugin.database) return true;
  return plugin.database.mysqlMigrationsFolder !== undefined;
}

/**
 * Whether a plugin should be doing anything here. The list of plugins that are on comes with a
 * restored backup, so it can name one made for Postgres on a database it can't run on. Its
 * tables aren't there, so it stays out of everything until it can run. Its place in the list is
 * kept, so it comes back if the site moves to Postgres again.
 */
export async function isPluginRunning(
  database: DatabaseOrTransaction,
  plugin: Pick<LintelPlugin, "id" | "database">,
): Promise<boolean> {
  return canRunOn(database, plugin) && (await isPluginEnabled(database, plugin.id));
}

/** The plugins that are on and can run here, from a list of those that are on. */
export function pluginIdsRunningHere(
  database: DatabaseOrTransaction,
  catalogue: Pick<PluginCatalogue, "find">,
  enabled: readonly string[],
): string[] {
  return enabled.filter((id) => {
    const plugin = catalogue.find(id);
    return !plugin || canRunOn(database, plugin);
  });
}

/** Every plugin in the catalogue, with whether it is on. */
export async function listPlugins(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
): Promise<PluginList> {
  const enabled = new Set(await findEnabledPluginIds(database));
  return {
    plugins: catalogue.entries.map(({ plugin, source }) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      enabled: enabled.has(plugin.id) && canRunOn(database, plugin),
      canRunHere: canRunOn(database, plugin),
      source,
      version: plugin.version ?? null,
      permissions: [...(plugin.permissions ?? [])],
      hasSettings: plugin.settings !== undefined,
    })),
  };
}

/**
 * Switches on exactly the given plugins and switches off the rest. Stored in catalogue
 * order without duplicates, so the same choice always looks the same. Plugins that have
 * just been switched on make their content (`createContent`). Switching off deletes
 * nothing: tables, settings and content all stay for when it is switched on again.
 */
export async function setEnabledPlugins(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  pluginIds: readonly string[],
): Promise<PluginList> {
  const unknown = pluginIds.filter((id) => !catalogue.has(id));
  if (unknown.length > 0) {
    throw new UnknownPluginError(unknown, catalogue.ids);
  }

  const wasEnabled = await findEnabledPluginIds(database);
  const enabled = catalogue.ids.filter((id) => pluginIds.includes(id));
  const refused = enabled
    .filter((id) => !wasEnabled.includes(id))
    .flatMap((id) => catalogue.find(id) ?? [])
    .filter((plugin) => !canRunOn(database, plugin));
  if (refused.length > 0) {
    throw new PluginNeedsPostgresError(refused.map((plugin) => plugin.name));
  }
  await writeSetting(database, "enabledPlugins", enabled);

  for (const pluginId of enabled.filter((id) => !wasEnabled.includes(id))) {
    await catalogue.find(pluginId)?.createContent?.(database);
  }
  return listPlugins(database, catalogue);
}
