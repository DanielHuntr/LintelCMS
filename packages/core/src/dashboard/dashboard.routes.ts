import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  findEntriesNeedingAttention,
  findMediaUsage,
  findMyRecentEdits,
  findRecentEdits,
  findScheduledEntries,
} from "./dashboard-widgets.service.js";
import { roleIdParamsSchema, saveDashboardLayoutRequestSchema } from "./dashboard.schema.js";
import {
  clearRoleLayout,
  findDashboardLayout,
  listRoleLayouts,
  resetDashboardLayout,
  saveDashboardLayout,
  saveRoleLayout,
} from "./dashboard.service.js";

/**
 * HTTP only.
 *
 * Layouts:
 *
 *   GET    /dashboard/layout                 (signed in)        -> { widgets | null, source }
 *   PUT    /dashboard/layout                 (signed in)        { widgets } -> the same
 *   DELETE /dashboard/layout                 (signed in)        -> the default they now see
 *   GET    /dashboard/role-layouts           (settings:update)  -> { roles: [{ id, name, widgets }] }
 *   PUT    /dashboard/role-layouts/:roleId   (settings:update)  { widgets } -> the same as GET
 *   DELETE /dashboard/role-layouts/:roleId   (settings:update)  -> the same as GET
 *
 * The built-in widgets' data:
 *
 *   GET /dashboard/widgets/recent-edits     (entries:read)  -> { entries, total }
 *   GET /dashboard/widgets/my-edits         (entries:read)  -> the same, changed by the signed-in person
 *   GET /dashboard/widgets/scheduled        (entries:read)  -> { entries, total }
 *   GET /dashboard/widgets/needs-attention  (entries:read)  -> { entries, total }
 *   GET /dashboard/widgets/media-usage      (media:read)    -> { fileCount, totalBytes, ... }
 */
export async function dashboardRoutes(server: FastifyInstance) {
  server.get("/dashboard/layout", { preHandler: requireSignedIn }, async (request) =>
    findDashboardLayout(server.database, getSignedIn(request).user.id),
  );

  server.put("/dashboard/layout", { preHandler: requireSignedIn }, async (request) => {
    const { widgets } = parseRequest(saveDashboardLayoutRequestSchema, request.body);
    return saveDashboardLayout(server.database, getSignedIn(request).user.id, widgets);
  });

  server.delete("/dashboard/layout", { preHandler: requireSignedIn }, async (request) =>
    resetDashboardLayout(server.database, getSignedIn(request).user.id),
  );

  const admins = { preHandler: requirePermission("settings:update") };

  server.get("/dashboard/role-layouts", admins, async () => listRoleLayouts(server.database));

  server.put("/dashboard/role-layouts/:roleId", admins, async (request) => {
    const { roleId } = parseRequest(roleIdParamsSchema, request.params);
    const { widgets } = parseRequest(saveDashboardLayoutRequestSchema, request.body);
    return saveRoleLayout(server.database, roleId, widgets);
  });

  server.delete("/dashboard/role-layouts/:roleId", admins, async (request) => {
    const { roleId } = parseRequest(roleIdParamsSchema, request.params);
    return clearRoleLayout(server.database, roleId);
  });

  const editors = { preHandler: requirePermission("entries:read") };

  server.get("/dashboard/widgets/recent-edits", editors, async () =>
    findRecentEdits(server.database),
  );
  server.get("/dashboard/widgets/my-edits", editors, async (request) =>
    findMyRecentEdits(server.database, getSignedIn(request).user.id),
  );
  server.get("/dashboard/widgets/scheduled", editors, async () =>
    findScheduledEntries(server.database),
  );
  server.get("/dashboard/widgets/needs-attention", editors, async () =>
    findEntriesNeedingAttention(server.database),
  );
  server.get(
    "/dashboard/widgets/media-usage",
    { preHandler: requirePermission("media:read") },
    async () => findMediaUsage(server.database),
  );
}
