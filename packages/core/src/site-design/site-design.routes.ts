import { siteDesignSchema } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { z } from "zod";
import { resolveEditingSite } from "../sites/request-site.js";
import { readSiteDesign, readSiteDesignRevision, saveSiteDesign } from "./site-design.service.js";

const revisionSchema = z.object({
  revision: z
    .string({ error: "revision should be the one read with the design" })
    .nullable()
    .optional(),
});

/**
 * HTTP only, for the site being edited (the `Lintel-Site` header):
 *
 *   GET /website/design  (entries:read)    -> { variables, sharedStyles, revision }
 *   PUT /website/design  (builder:blocks)  { variables, sharedStyles, revision? } -> the same
 *
 * `revision` says which save the design is (null before the first). A PUT that sends the one
 * it read is refused with 409 SITE_DESIGN_CHANGED when someone has saved since.
 *
 * Changing it changes every page, like changing a block, so it needs the same permission.
 */
export async function siteDesignRoutes(server: FastifyInstance) {
  server.get(
    "/website/design",
    { preHandler: requirePermission("entries:read") },
    async (request) => {
      const site = await resolveEditingSite(request);
      return {
        ...(await readSiteDesign(server.database, site)),
        revision: await readSiteDesignRevision(server.database, site),
      };
    },
  );

  server.put(
    "/website/design",
    { preHandler: requirePermission("builder:blocks") },
    async (request) => {
      const design = parseRequest(siteDesignSchema, request.body);
      const { revision } = parseRequest(revisionSchema, request.body ?? {});
      const site = await resolveEditingSite(request);
      const saved = await saveSiteDesign(server.database, site, design, revision);
      return { ...saved, revision: await readSiteDesignRevision(server.database, site) };
    },
  );
}
