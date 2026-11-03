import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { readSiteEffects, updateSiteEffects } from "./site-effects.service.js";

/**
 * HTTP only, for the site being edited (the `Lintel-Site` header):
 *
 *   GET /website/effects  (entries:read)    -> { pageTransition, cursor, intro, smoothScroll }
 *   PUT /website/effects  (settings:update) any of those -> all of them
 */
export async function siteEffectsRoutes(server: FastifyInstance) {
  server.get(
    "/website/effects",
    { preHandler: requirePermission("entries:read") },
    async (request) => readSiteEffects(server.database, await resolveEditingSite(request)),
  );

  server.put(
    "/website/effects",
    { preHandler: requirePermission("settings:update") },
    async (request) =>
      updateSiteEffects(server.database, await resolveEditingSite(request), request.body),
  );
}
