import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { listSecurityEventsQuerySchema } from "./security-log.schema.js";
import { exportSecurityEventsAsCsv, listSecurityEvents } from "./security-log.service.js";

/**
 * HTTP only:
 *
 *   GET /security-log         (security:read)  ?kind&page&perPage -> { events, page, perPage, total }
 *   GET /security-log/export  (security:read)  ?kind -> text/csv download
 */
export async function securityLogRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("security:read") };

  server.get("/security-log", canRead, async (request) => {
    const query = parseRequest(listSecurityEventsQuerySchema, request.query);
    return listSecurityEvents(server.database, query);
  });

  server.get("/security-log/export", canRead, async (request, reply) => {
    const { kind } = parseRequest(listSecurityEventsQuerySchema, request.query);
    const csv = await exportSecurityEventsAsCsv(server.database, kind);
    const day = new Date().toISOString().slice(0, 10);
    return reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="security-log-${day}.csv"`)
      .header("cache-control", "no-store")
      .send(csv);
  });
}
