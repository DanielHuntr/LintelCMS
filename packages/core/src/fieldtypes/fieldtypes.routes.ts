import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { listFieldtypes } from "./fieldtypes.service.js";

/**
 * HTTP only:
 *
 *   GET /fieldtypes   (blueprints:read)  -> { fieldtypes: [{ type, name, description }] }
 */
export async function fieldtypesRoutes(server: FastifyInstance) {
  server.get("/fieldtypes", { preHandler: requirePermission("blueprints:read") }, async () =>
    listFieldtypes(),
  );
}
