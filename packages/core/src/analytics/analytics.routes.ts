import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { contentDisposition } from "../media/content-disposition.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { entryStatsParamsSchema, statsQuerySchema } from "./analytics.schema.js";
import { findEntryPage } from "./entry-pages.service.js";
import { exportVisitorStatsAsCsv, readPageStats, readVisitorStats } from "./stats.service.js";

/**
 * HTTP only. The Visitors plugin's figures for the admin, for the site being worked on
 * (`Lintel-Site`, see src/sites). Every route needs `analytics:read`.
 *
 *   GET /analytics/stats?range=today|7d|30d|custom&from=&to=   -> VisitorStats
 *   GET /analytics/pages?path=/about&range=...                 -> PageVisitorStats
 *   GET /analytics/entries/:entryId?range=...                  -> PageVisitorStats for its page
 *   GET /analytics/export?range=...                            -> text/csv
 */
export async function analyticsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("analytics:read") };

  server.get("/analytics/stats", canRead, async (request) => {
    const query = parseRequest(statsQuerySchema, request.query);
    return readVisitorStats(server.database, await resolveEditingSite(request), query);
  });

  server.get("/analytics/pages", canRead, async (request) => {
    const query = parseRequest(statsQuerySchema, request.query);
    const site = await resolveEditingSite(request);
    return readPageStats(server.database, site, query.path ?? "/", query);
  });

  server.get("/analytics/entries/:entryId", canRead, async (request) => {
    const { entryId } = parseRequest(entryStatsParamsSchema, request.params);
    const query = parseRequest(statsQuerySchema, request.query);
    const page = await findEntryPage(server.database, request.signedIn, entryId);
    return readPageStats(server.database, page.site, page.path, query);
  });

  server.get("/analytics/export", canRead, async (request, reply) => {
    const query = parseRequest(statsQuerySchema, request.query);
    const site = await resolveEditingSite(request);
    const { filename, csv } = await exportVisitorStatsAsCsv(server.database, site, query);
    return reply
      .type("text/csv; charset=utf-8")
      .header("content-disposition", contentDisposition("attachment", filename))
      .send(csv);
  });
}
