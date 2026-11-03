import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { scheduledEntriesQuerySchema } from "./entries.schema.js";
import { listScheduledEntries } from "./scheduled-entries.service.js";

/**
 * HTTP only:
 *
 *   GET /entries/scheduled  (entries:read)  ?from=&to= (at most 62 days apart)
 *       -> { entries: [{ id, title, locale, collectionHandle, collectionName, scheduledFor, action }] }
 *
 * For the schedule calendar. It lists the site being worked on (see src/sites/request-site.ts),
 * with the entries of shared collections.
 */
export async function scheduledEntriesRoutes(server: FastifyInstance) {
  server.get(
    "/entries/scheduled",
    { preHandler: requirePermission("entries:read") },
    async (request) =>
      listScheduledEntries(
        server.database,
        parseRequest(scheduledEntriesQuerySchema, request.query),
        await resolveEditingSite(request),
      ),
  );
}
