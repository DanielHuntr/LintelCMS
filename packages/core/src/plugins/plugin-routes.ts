import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { readPluginSettings } from "./plugin-settings.service.js";
import { PluginNotEnabledError } from "./plugins.errors.js";
import { isPluginRunning } from "./plugins.service.js";

/**
 * A preHandler that answers 404 PLUGIN_NOT_ENABLED while the plugin is switched off. Every
 * plugin's routes get it automatically (see `registerPluginRoutes`); export it for code
 * outside a plugin's own routes that belongs to the plugin.
 */
export function requirePluginEnabled(plugin: Pick<LintelPlugin, "id" | "name" | "database">) {
  return async function checkPluginEnabled(request: FastifyRequest): Promise<void> {
    const { database } = request.server;
    if (!(await isPluginRunning(database, plugin))) {
      throw new PluginNotEnabledError(plugin.name);
    }
  };
}

/** A route a plugin registered: "GET /bookings/slots". */
export interface RegisteredPluginRoute {
  method: string;
  path: string;
}

const routesByPlugin = new Map<string, RegisteredPluginRoute[]>();

/** The routes a plugin registered when the server was built, for Build → Add-ons to check. */
export function listRegisteredPluginRoutes(pluginId: string): RegisteredPluginRoute[] {
  return routesByPlugin.get(pluginId) ?? [];
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
    routesByPlugin.set(plugin.id, []);
    server.register(async (scope) => {
      scope.addHook("onRoute", (route) => {
        const methods = Array.isArray(route.method) ? route.method : [route.method];
        for (const method of methods) {
          if (method === "HEAD") continue;
          routesByPlugin.get(plugin.id)?.push({ method, path: route.url });
        }
      });
      scope.addHook("preHandler", requirePluginEnabled(plugin));
      await routes.call(plugin, scope, {
        readSettings: (database) => readPluginSettings(database, plugin),
      });
    });
  }
}
