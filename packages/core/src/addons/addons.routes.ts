import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { addonIdParamsSchema } from "./addons.schema.js";
import { listAddons, listAdminScripts, readAdminFile } from "./addons.service.js";

/**
 * HTTP only:
 *
 *   GET /addons                 (settings:read)  -> { addons: [AddonSummary], folder }
 *   GET /addons/admin-scripts   (anyone)         -> { scripts: [{ id, script, styles }] }
 *   GET /addons/:id/admin.js    (anyone)         -> the add-on's admin half
 *   GET /addons/:id/admin.css   (anyone)         -> its admin stylesheet
 *
 * Switching add-ons on and off, and their settings, use the plugins endpoints. The admin
 * files are code, public like the admin's own, and are loaded before anyone signs in.
 */
export async function addonsRoutes(server: FastifyInstance) {
  server.get("/addons", { preHandler: requirePermission("settings:read") }, async () =>
    listAddons(server.database, server.plugins, server.addons),
  );

  server.get("/addons/admin-scripts", async () => listAdminScripts(server.addons));

  server.get("/addons/:id/admin.js", async (request, reply) => {
    const { id } = parseRequest(addonIdParamsSchema, request.params);
    const script = await readAdminFile(server.addons, id, "script");
    return reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "no-cache")
      .send(script);
  });

  server.get("/addons/:id/admin.css", async (request, reply) => {
    const { id } = parseRequest(addonIdParamsSchema, request.params);
    const styles = await readAdminFile(server.addons, id, "styles");
    return reply.type("text/css; charset=utf-8").header("cache-control", "no-cache").send(styles);
  });
}
