import { siteSectionsChangeSchema } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { hasPermission } from "../roles/permissions.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { changeSiteSections, readSiteSections } from "./site-sections.service.js";

/**
 * HTTP only, for the site being edited (the `Lintel-Site` header):
 *
 *   GET /website/sections  (entries:read)    -> { navigation, footer }
 *   PUT /website/sections  (builder:blocks)  { navigation?, footer? } -> both, as saved
 *
 * A slot left out of a PUT stays as it is; null takes it off the site. Changing them changes
 * every page, like changing a block, so it needs the same permission.
 */
export async function siteSectionsRoutes(server: FastifyInstance) {
  server.get(
    "/website/sections",
    { preHandler: requirePermission("entries:read") },
    async (request) => readSiteSections(server.database, await resolveEditingSite(request)),
  );

  server.put(
    "/website/sections",
    { preHandler: requirePermission("builder:blocks") },
    async (request) => {
      const change = parseRequest(siteSectionsChangeSchema, request.body ?? {});
      return changeSiteSections(server.database, await resolveEditingSite(request), change, {
        mayEditCode: hasPermission(getSignedIn(request).permissions, "builder:code"),
      });
    },
  );
}
