import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { updateSiteAddressRequestSchema } from "./site-address.schema.js";
import { readSiteAddress, saveSiteAddress } from "./site-address.service.js";

/**
 * The website Lintel's content is shown on (Settings → Site). HTTP only:
 *
 *   GET /site-address  (settings:read)    -> { siteAddress }
 *   PUT /site-address  (settings:update)  { siteAddress } -> the same
 *
 * Everyone signed in also gets it in their session, for "View page" in the editor.
 */
export async function siteAddressRoutes(server: FastifyInstance) {
  server.get("/site-address", { preHandler: requirePermission("settings:read") }, async () => ({
    siteAddress: await readSiteAddress(server.database),
  }));

  server.put(
    "/site-address",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const { siteAddress } = parseRequest(updateSiteAddressRequestSchema, request.body);
      return { siteAddress: await saveSiteAddress(server.database, siteAddress) };
    },
  );
}
