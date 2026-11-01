import { siteEffectSettingsSchema } from "@lintel/motion/effects";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { readSiteEffects, updateSiteEffects } from "./site-effects.service.js";

/**
 * HTTP only:
 *
 *   GET /website/effects  (entries:read)    -> { pageTransition, cursor, intro }
 *   PUT /website/effects  (settings:update) any of { pageTransition, cursor, intro } -> the same
 */
const updateSiteEffectsRequestSchema = siteEffectSettingsSchema.partial();

export async function siteEffectsRoutes(server: FastifyInstance) {
  server.get("/website/effects", { preHandler: requirePermission("entries:read") }, async () =>
    readSiteEffects(server.database),
  );

  server.put(
    "/website/effects",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const changes = parseRequest(updateSiteEffectsRequestSchema, request.body);
      return updateSiteEffects(server.database, changes);
    },
  );
}
