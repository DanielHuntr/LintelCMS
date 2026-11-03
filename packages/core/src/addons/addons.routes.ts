import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  deleteAddonData,
  describeAddon,
  exportAddonData,
  exportAddonTableCsv,
} from "./addon-details.service.js";
import {
  addonExportQuerySchema,
  addonIdParamsSchema,
  deleteAddonDataRequestSchema,
} from "./addons.schema.js";
import { listAddons, listAdminScripts, readAdminFile } from "./addons.service.js";

/**
 * HTTP only:
 *
 *   GET /addons                 (settings:read)  -> { addons: [AddonSummary], folder }
 *   GET /addons/admin-scripts   (anyone)         -> { scripts: [{ id, script, styles }] }
 *   GET /addons/:id/admin.js    (anyone)         -> the add-on's admin half
 *   GET /addons/:id/admin.css   (anyone)         -> its admin stylesheet
 *   GET /addons/:id/details     (settings:read)  -> AddonDetails: what it keeps and does
 *   GET /addons/:id/export      (settings:update) -> its data: ?format=json, or csv&table=
 *   POST /addons/:id/delete-data (settings:update) { confirm: "DELETE" } -> { emptied }
 *
 * Switching add-ons on and off, and their settings, use the plugins endpoints. The admin
 * files are code, public like the admin's own, and are loaded before anyone signs in.
 */
export async function addonsRoutes(server: FastifyInstance) {
  server.get("/addons", { preHandler: requirePermission("settings:read") }, async () =>
    listAddons(server.database, server.plugins, server.addons),
  );

  server.get("/addons/admin-scripts", async () => listAdminScripts(server.addons));

  server.get(
    "/addons/:id/details",
    { preHandler: requirePermission("settings:read") },
    async (request) => {
      const { id } = parseRequest(addonIdParamsSchema, request.params);
      return describeAddon(server.database, server.plugins, server.addons, id);
    },
  );

  // Its data can name people, so exporting it takes the same permission as changing it.
  server.get(
    "/addons/:id/export",
    { preHandler: requirePermission("settings:update") },
    async (request, reply) => {
      const { id } = parseRequest(addonIdParamsSchema, request.params);
      const { format, table } = parseRequest(addonExportQuerySchema, request.query);
      if (format === "csv" && table) {
        const csv = await exportAddonTableCsv(
          server.database,
          server.plugins,
          server.addons,
          id,
          table,
        );
        return reply
          .type("text/csv; charset=utf-8")
          .header("content-disposition", `attachment; filename="${id}-${table}.csv"`)
          .send(csv);
      }
      const data = await exportAddonData(server.database, server.plugins, server.addons, id);
      return reply
        .type("application/json; charset=utf-8")
        .header("content-disposition", `attachment; filename="${id}-data.json"`)
        .send(JSON.stringify(data, null, 2));
    },
  );

  server.post(
    "/addons/:id/delete-data",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const { id } = parseRequest(addonIdParamsSchema, request.params);
      parseRequest(deleteAddonDataRequestSchema, request.body);
      return deleteAddonData(server.database, server.plugins, server.addons, id);
    },
  );

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
