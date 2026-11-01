import { prettifyError } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { InvalidRequestError } from "../http/http-errors.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";
import type { LintelPlugin, PluginSettings } from "./plugin-definition.js";
import { PluginHasNoSettingsError } from "./plugins.errors.js";

/**
 * A plugin's settings live in the settings table under "plugin:<id>", checked by the
 * plugin's own Zod schema. Like core settings, a value that no longer fits the schema
 * (after the plugin changed its schema, say) reads as the defaults rather than failing.
 */

function settingKey(pluginId: string): string {
  return `plugin:${pluginId}`;
}

function settingsOf(plugin: LintelPlugin): PluginSettings {
  if (!plugin.settings) {
    throw new PluginHasNoSettingsError(plugin.name);
  }
  return plugin.settings;
}

export async function readPluginSettings(
  database: DatabaseOrTransaction,
  plugin: LintelPlugin,
): Promise<unknown> {
  const settings = settingsOf(plugin);
  const stored = await findSettingValue(database, DEFAULT_TENANT_ID, settingKey(plugin.id));
  if (stored === undefined) {
    return settings.defaults;
  }
  const parsed = settings.schema.safeParse(stored);
  return parsed.success ? parsed.data : settings.defaults;
}

/** Saves new settings, which must pass the plugin's schema; gives back what was saved. */
export async function updatePluginSettings(
  database: DatabaseOrTransaction,
  plugin: LintelPlugin,
  input: unknown,
): Promise<unknown> {
  const parsed = settingsOf(plugin).schema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidRequestError(prettifyError(parsed.error));
  }
  await upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(plugin.id), parsed.data);
  return parsed.data;
}
