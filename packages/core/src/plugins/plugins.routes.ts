import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { PluginNotFoundError } from "./plugins.errors.js";
import { pluginIdParamsSchema, updatePluginsRequestSchema } from "./plugins.schema.js";
import { listPlugins, setEnabledPlugins } from "./plugins.service.js";
import { readPluginSettings, updatePluginSettings } from "./plugin-settings.service.js";

/**
 * HTTP only:
 *
 *   GET /plugins               (settings:read)    -> { plugins: [{ id, name, description, enabled, ... }] }
 *   PUT /plugins               (settings:update)  { enabled: [ids] } -> the same shape as GET
 *   GET /plugins/:id/settings  (settings:read)    -> the plugin's settings
 *   PUT /plugins/:id/settings  (settings:update)  the whole settings object -> what was saved
 */
export async function pluginsRoutes(server: FastifyInstance) {
  server.get("/plugins", { preHandler: requirePermission("settings:read") }, async () =>
    listPlugins(server.database, server.plugins),
  );

  server.put("/plugins", { preHandler: requirePermission("settings:update") }, async (request) => {
    const { enabled } = parseRequest(updatePluginsRequestSchema(server.plugins.ids), request.body);
    return setEnabledPlugins(server.database, server.plugins, enabled);
  });

  server.get(
    "/plugins/:id/settings",
    { preHandler: requirePermission("settings:read") },
    async (request) => readPluginSettings(server.database, findPlugin(server, request.params)),
  );

  server.put(
    "/plugins/:id/settings",
    { preHandler: requirePermission("settings:update") },
    async (request) =>
      updatePluginSettings(server.database, findPlugin(server, request.params), request.body),
  );
}

function findPlugin(server: FastifyInstance, params: unknown) {
  const { id } = parseRequest(pluginIdParamsSchema, params);
  const plugin = server.plugins.find(id);
  if (!plugin) {
    throw new PluginNotFoundError(id);
  }
  return plugin;
}
