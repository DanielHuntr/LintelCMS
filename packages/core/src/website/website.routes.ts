import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { updateWebsiteRequestSchema } from "./website.schema.js";
import { readWebsite, updateWebsite } from "./website.service.js";

/**
 * HTTP only:
 *
 *   GET /website  (settings:read)    -> Website
 *   PUT /website  (settings:update)  any of { template, brandColour, accentColour,
 *                                    fontPairing, cornerStyle, spacing, colourScheme,
 *                                    logoAssetId, siteAddress } -> Website
 */
export async function websiteRoutes(server: FastifyInstance) {
  const context = () => ({
    templates: server.website.templates,
    builtInSiteUrl: server.website.builtInSiteUrl,
  });

  server.get("/website", { preHandler: requirePermission("settings:read") }, async () =>
    readWebsite(server.database, context()),
  );

  server.put("/website", { preHandler: requirePermission("settings:update") }, async (request) => {
    const changes = parseRequest(updateWebsiteRequestSchema, request.body);
    return updateWebsite(server.database, changes, {
      ...context(),
      assetExists: server.assetExists,
    });
  });
}
