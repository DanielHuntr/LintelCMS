import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { treeEntryParamsSchema } from "../content-tree/content-tree.schema.js";
import { parseRequest } from "../http/http-errors.js";
import { saveRootHostnamesRequestSchema } from "./content-roots.schema.js";
import { readRootHostnames, saveRootHostnames } from "./content-roots.service.js";

/**
 * HTTP only:
 *
 *   GET /content-tree/entries/:id/hostnames   (entries:read)     what "Hostnames" shows
 *   PUT /content-tree/entries/:id/hostnames   (settings:update)  { hostname, pathPrefix }
 *
 * Giving a page its own domain changes where the site answers, so it is a settings change.
 */
export async function contentRootsRoutes(server: FastifyInstance) {
  server.get(
    "/content-tree/entries/:id/hostnames",
    { preHandler: requirePermission("entries:read") },
    async (request) =>
      readRootHostnames(server.database, parseRequest(treeEntryParamsSchema, request.params).id),
  );

  server.put(
    "/content-tree/entries/:id/hostnames",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const { id } = parseRequest(treeEntryParamsSchema, request.params);
      const body = parseRequest(saveRootHostnamesRequestSchema, request.body ?? {});
      const saved = await saveRootHostnames(server.database, id, body);
      // Addresses on the built-in website follow, so pages rendered before are out of date.
      server.website.renderedPages.clear();
      return saved;
    },
  );
}
