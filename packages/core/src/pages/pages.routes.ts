import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { pageSettingsSchema } from "./pages.schema.js";
import { readPageSettings, updatePageSettings } from "./pages.service.js";

/**
 * HTTP only:
 *
 *   GET   /pages/settings  (entries:read)     -> { customScripts }
 *   PATCH /pages/settings  (settings:update)  { customScripts } -> { customScripts }
 *
 * Pages themselves are saved through the entries API, as the value of a page field.
 */
export async function pagesRoutes(server: FastifyInstance) {
  server.get("/pages/settings", { preHandler: requirePermission("entries:read") }, async () =>
    readPageSettings(server.database),
  );

  server.patch(
    "/pages/settings",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const settings = parseRequest(pageSettingsSchema, request.body);
      return updatePageSettings(server.database, settings);
    },
  );
}
