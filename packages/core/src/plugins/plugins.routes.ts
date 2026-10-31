import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { updatePluginsRequestSchema } from "./plugins.schema.js";
import { listPlugins, setEnabledPlugins } from "./plugins.service.js";

/**
 * HTTP only:
 *
 *   GET /plugins   (settings:read)    -> { plugins: [{ id, name, description, enabled }] }
 *   PUT /plugins   (settings:update)  { enabled: [ids] } -> the same shape as GET
 */
export async function pluginsRoutes(server: FastifyInstance) {
  server.get("/plugins", { preHandler: requirePermission("settings:read") }, async () =>
    listPlugins(server.database),
  );

  server.put("/plugins", { preHandler: requirePermission("settings:update") }, async (request) => {
    const { enabled } = parseRequest(updatePluginsRequestSchema, request.body);
    return setEnabledPlugins(server.database, enabled);
  });
}
