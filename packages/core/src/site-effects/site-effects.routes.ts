import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { readSiteEffects, updateSiteEffects } from "./site-effects.service.js";

/**
 * HTTP only:
 *
 *   GET /website/effects  (entries:read)    -> { pageTransition, cursor, intro, smoothScroll }
 *   PUT /website/effects  (settings:update) any of those -> all of them
 */
export async function siteEffectsRoutes(server: FastifyInstance) {
  server.get("/website/effects", { preHandler: requirePermission("entries:read") }, async () =>
    readSiteEffects(server.database),
  );

  server.put(
    "/website/effects",
    { preHandler: requirePermission("settings:update") },
    async (request) => updateSiteEffects(server.database, request.body),
  );
}
