import { siteDesignSchema } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { readSiteDesign, saveSiteDesign } from "./site-design.service.js";

/**
 * HTTP only:
 *
 *   GET /website/design  (entries:read)    -> { variables, sharedStyles }
 *   PUT /website/design  (builder:blocks)  { variables, sharedStyles } -> the same, as saved
 *
 * Changing it changes every page, like changing a block, so it needs the same permission.
 */
export async function siteDesignRoutes(server: FastifyInstance) {
  server.get("/website/design", { preHandler: requirePermission("entries:read") }, async () =>
    readSiteDesign(server.database),
  );

  server.put(
    "/website/design",
    { preHandler: requirePermission("builder:blocks") },
    async (request) => {
      const design = parseRequest(siteDesignSchema, request.body);
      return saveSiteDesign(server.database, design);
    },
  );
}
