import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { updateDeliveryAccessRequestSchema } from "./delivery-access.schema.js";
import { readDeliveryAccess, updateDeliveryAccess } from "./delivery-access.service.js";

/**
 * HTTP only:
 *
 *   GET /delivery-access  (settings:read)    -> { requireToken, allowedOrigins }
 *   PUT /delivery-access  (settings:update)  { requireToken?, allowedOrigins? } -> the same
 */
export async function deliveryAccessRoutes(server: FastifyInstance) {
  server.get("/delivery-access", { preHandler: requirePermission("settings:read") }, async () =>
    readDeliveryAccess(server.database),
  );

  server.put(
    "/delivery-access",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const changes = parseRequest(updateDeliveryAccessRequestSchema, request.body);
      return updateDeliveryAccess(server.database, changes);
    },
  );
}
