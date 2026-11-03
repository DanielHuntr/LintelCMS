import { siteEffectSettingsSchema } from "@lintel/motion/effects";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { readSiteEffects, updateSiteEffects } from "./site-effects.service.js";

/**
 * HTTP only:
 *
 *   GET /website/effects  (entries:read)    -> { pageTransition, cursor, intro, smoothScroll }
 *   PUT /website/effects  (settings:update) any of those -> all of them
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
      const parsed = parseRequest(updateSiteEffectsRequestSchema, request.body);
      // The schema fills in defaults for parts left out; only the parts sent are changes.
      const sent = new Set(Object.keys(request.body as object));
      const changes = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => sent.has(key)),
      ) as typeof parsed;
      return updateSiteEffects(server.database, changes);
    },
  );
}
