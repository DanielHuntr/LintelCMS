import type { FastifyInstance } from "fastify";
import { requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { updateWebsiteRequestSchema } from "./website.schema.js";
import { readCanvasSite } from "./canvas.service.js";
import { readSiteAddress, readWebsite, updateWebsite } from "./website.service.js";

/**
 * HTTP only:
 *
 *   GET /website          (settings:read)  -> Website
 *   GET /website/address  (signed in)      -> { siteAddress, defaultLocale }, for "View page"
 *   GET /website/canvas   (entries:read)   -> the stylesheet, header, footer and motion runtime
 *                                             the page builder draws its canvas with
 *   PUT /website          (settings:update) any of { template, brandColour, accentColour,
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

  server.get("/website/address", { preHandler: requireSignedIn }, async () =>
    readSiteAddress(server.database, server.website.builtInSiteUrl),
  );

  server.get("/website/canvas", { preHandler: requirePermission("entries:read") }, async () =>
    readCanvasSite({
      database: server.database,
      assetLookup: server.assetLookup,
      templates: server.website.templates,
      builtInSiteUrl: server.website.builtInSiteUrl,
      cache: server.website.renderedPages,
    }),
  );

  server.put("/website", { preHandler: requirePermission("settings:update") }, async (request) => {
    const changes = parseRequest(updateWebsiteRequestSchema, request.body);
    return updateWebsite(server.database, changes, {
      ...context(),
      assetExists: server.assetExists,
    });
  });
}
