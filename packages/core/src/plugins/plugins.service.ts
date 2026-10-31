import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { isPluginId, type PluginId, pluginRegistry } from "./plugins.registry.js";
import type { PluginList } from "./plugins.schema.js";

/**
 * Which plugins are switched on. Ids no longer in the registry (a plugin that was
 * removed) are left out, so the admin is never told about something that doesn't exist.
 */
export async function findEnabledPluginIds(database: DatabaseOrTransaction): Promise<PluginId[]> {
  const stored = await readSetting(database, "enabledPlugins");
  return pluginRegistry.map((plugin) => plugin.id).filter((id) => stored.includes(id));
}

/** Every plugin in the registry, with whether it is on. */
export async function listPlugins(database: DatabaseOrTransaction): Promise<PluginList> {
  const enabled = new Set<string>(await findEnabledPluginIds(database));
  return {
    plugins: pluginRegistry.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      enabled: enabled.has(plugin.id),
    })),
  };
}

/**
 * Switches on exactly the given plugins and switches off the rest. Stored in registry
 * order without duplicates, so the same choice always looks the same.
 */
export async function setEnabledPlugins(
  database: DatabaseOrTransaction,
  pluginIds: readonly string[],
): Promise<PluginList> {
  const unknown = pluginIds.filter((id) => !isPluginId(id));
  if (unknown.length > 0) {
    // Routes check this with plugins.schema.ts first; this guards other callers.
    throw new Error(`Unknown plugin ids: ${unknown.join(", ")}`);
  }

  const enabled = pluginRegistry.map((plugin) => plugin.id).filter((id) => pluginIds.includes(id));
  await writeSetting(database, "enabledPlugins", enabled);
  return listPlugins(database);
}
