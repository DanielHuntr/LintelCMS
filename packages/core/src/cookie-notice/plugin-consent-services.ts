import type { ConsentService } from "@lintel/builder-model";

/**
 * Services plugins say their pages load from other companies (a booking calendar, a chat
 * window), declared with `consentServices` in `definePlugin`. While a plugin is switched on,
 * the cookie notice names them, and the plugin's own script asks before loading anything:
 * `window.lintelConsent.allows("plugin:<plugin id>:<handle>")`.
 */

/** As a plugin declares one: a handle of its own and the name visitors read. */
export interface PluginConsentService {
  /** Lowercase letters, numbers and dashes: "calendar". */
  handle: string;
  /** "Calendly", "Intercom". */
  name: string;
}

const servicesByPlugin = new Map<string, ConsentService[]>();

/** The id a plugin's service is allowed under. */
export function pluginConsentServiceId(pluginId: string, handle: string): string {
  return `plugin:${pluginId}:${handle}`;
}

/** Remembers a plugin's services; called for each plugin as the server is built. */
export function registerPluginConsentServices(
  pluginId: string,
  services: readonly PluginConsentService[],
): void {
  if (services.length === 0) {
    servicesByPlugin.delete(pluginId);
    return;
  }
  servicesByPlugin.set(
    pluginId,
    services.map(({ handle, name }) => ({ id: pluginConsentServiceId(pluginId, handle), name })),
  );
}

/** The services of the plugins that are switched on. */
export function listPluginConsentServices(enabledPlugins: readonly string[]): ConsentService[] {
  return enabledPlugins.flatMap((pluginId) => servicesByPlugin.get(pluginId) ?? []);
}
