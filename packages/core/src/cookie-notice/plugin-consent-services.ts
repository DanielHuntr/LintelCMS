import type { ConsentService } from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";

/**
 * Services plugins say their pages load from other companies (a booking calendar, a chat
 * window), declared with `consentServices` in `definePlugin`. While a plugin is switched on,
 * the cookie notice names them, and the plugin's own script asks before loading anything:
 * `window.lintelConsent.allows("plugin:<plugin id>:<handle>")`.
 *
 * A plugin can also name services that depend on its settings, with
 * `consentServicesFromSettings`: Visitors lists "Visitor counts" only while a site counts
 * visitors after they accept. Those are read afresh each time the notice is worked out.
 */

/** As a plugin declares one: a handle of its own and the name visitors read. */
export interface PluginConsentService {
  /** Lowercase letters, numbers and dashes: "calendar". */
  handle: string;
  /** "Calendly", "Intercom". */
  name: string;
}

/** As a plugin's settings name one. Without a handle it stands for the plugin itself. */
export interface SettingsConsentService {
  handle?: string;
  name: string;
  /** It counts visits and sets no cookies, so the notice says so rather than "may set cookies". */
  countsWithoutCookies?: boolean;
}

/** Reads a plugin's saved settings and says which services they need asked about. */
export type SettingsConsentServicesReader = (
  database: DatabaseOrTransaction,
) => Promise<readonly SettingsConsentService[]>;

const servicesByPlugin = new Map<string, ConsentService[]>();
const readersByPlugin = new Map<string, SettingsConsentServicesReader>();

/** The id a plugin's service is allowed under: "plugin:<id>", or "plugin:<id>:<handle>". */
export function pluginConsentServiceId(pluginId: string, handle?: string): string {
  return handle ? `plugin:${pluginId}:${handle}` : `plugin:${pluginId}`;
}

/** Remembers a plugin's services; called for each plugin as the server is built. */
export function registerPluginConsentServices(
  pluginId: string,
  services: readonly PluginConsentService[],
  fromSettings?: SettingsConsentServicesReader,
): void {
  if (fromSettings) readersByPlugin.set(pluginId, fromSettings);
  else readersByPlugin.delete(pluginId);
  if (services.length === 0) {
    servicesByPlugin.delete(pluginId);
    return;
  }
  servicesByPlugin.set(
    pluginId,
    services.map(({ handle, name }) => ({ id: pluginConsentServiceId(pluginId, handle), name })),
  );
}

/** The declared services of the plugins that are switched on. */
export function listPluginConsentServices(enabledPlugins: readonly string[]): ConsentService[] {
  return enabledPlugins.flatMap((pluginId) => servicesByPlugin.get(pluginId) ?? []);
}

/** The services of the plugins that are switched on, both declared and from their settings. */
export async function findPluginConsentServices(
  database: DatabaseOrTransaction,
  enabledPlugins: readonly string[],
): Promise<ConsentService[]> {
  const fromSettings = await Promise.all(
    enabledPlugins.map(async (pluginId) => {
      const read = readersByPlugin.get(pluginId);
      if (!read) return [];
      return (await read(database)).map(({ handle, name, countsWithoutCookies }) => ({
        id: pluginConsentServiceId(pluginId, handle),
        name,
        ...(countsWithoutCookies ? { countsWithoutCookies } : {}),
      }));
    }),
  );
  return [...listPluginConsentServices(enabledPlugins), ...fromSettings.flat()];
}
