import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { readPluginSettings } from "./plugin-settings.service.js";
import { PluginNotEnabledError } from "./plugins.errors.js";
import { isPluginEnabled } from "./plugins.service.js";

/**
 * A preHandler that answers 404 PLUGIN_NOT_ENABLED while the plugin is switched off. Every
 * plugin's routes get it automatically (see `registerPluginRoutes`); export it for code
 * outside a plugin's own routes that belongs to the plugin.
 */
export function requirePluginEnabled(plugin: Pick<LintelPlugin, "id" | "name">) {
  return async function checkPluginEnabled(request: FastifyRequest): Promise<void> {
    if (!(await isPluginEnabled(request.server.database, plugin.id))) {
      throw new PluginNotEnabledError(plugin.name);
    }
  };
}

/**
 * Registers every plugin's routes, each in a Fastify scope of its own. The scope's first
 * hook checks the plugin is on, so it runs before any permission check a route adds, and
 * a switched-off plugin looks the same to everyone: not there.
 */
export function registerPluginRoutes(server: FastifyInstance, catalogue: PluginCatalogue): void {
  for (const plugin of catalogue.plugins) {
    const { routes } = plugin;
    if (!routes) continue;
    server.register(async (scope) => {
      scope.addHook("preHandler", requirePluginEnabled(plugin));
      await routes.call(plugin, scope, {
        readSettings: (database) => readPluginSettings(database, plugin),
      });
    });
  }
}
