import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { updateCookieNoticeRequestSchema } from "./cookie-notice.schema.js";
import { describeCookieNotice, updateCookieNoticeSettings } from "./cookie-notice.service.js";

/**
 * HTTP only:
 *
 *   GET /website/cookie-notice  (settings:read)   -> { settings, services, shown }
 *   PUT /website/cookie-notice  (settings:update) any of the settings -> the same
 *
 * The services are those of the site being worked on (the `lintel-site` header).
 */
export async function cookieNoticeRoutes(server: FastifyInstance) {
  server.get(
    "/website/cookie-notice",
    { preHandler: requirePermission("settings:read") },
    async (request) => describeCookieNotice(server.database, await resolveEditingSite(request)),
  );

  server.put(
    "/website/cookie-notice",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const parsed = parseRequest(updateCookieNoticeRequestSchema, request.body);
      // The schema fills in defaults for parts left out; only the parts sent are changes.
      const sent = new Set(Object.keys((request.body ?? {}) as object));
      const changes = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => sent.has(key)),
      ) as typeof parsed;
      await updateCookieNoticeSettings(server.database, changes);
      return describeCookieNotice(server.database, await resolveEditingSite(request));
    },
  );
}
