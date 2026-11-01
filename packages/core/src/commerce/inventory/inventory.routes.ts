import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import { createLocationRequestSchema, updateLocationRequestSchema } from "./inventory.schema.js";
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
} from "./locations.service.js";

/**
 * HTTP only. Stock levels themselves are saved with their product (see src/commerce/products).
 *
 *   GET    /shop/locations       (commerce:read)    -> { locations }
 *   POST   /shop/locations       (commerce:update)  { name } -> 201
 *   PATCH  /shop/locations/:id   (commerce:update)  { name?, isActive? }
 *   DELETE /shop/locations/:id   (commerce:update)  -> 204; the last location can't be deleted
 */
export async function inventoryRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/locations", read, async () => listLocations(server.database));

  server.post("/shop/locations", update, async (request, reply) => {
    const location = parseRequest(createLocationRequestSchema, request.body);
    return reply.code(201).send(await createLocation(server.database, location));
  });

  server.patch("/shop/locations/:id", update, async (request) => {
    const changes = parseRequest(updateLocationRequestSchema, request.body);
    return updateLocation(server.database, readIdParam(request.params, "location"), changes);
  });

  server.delete("/shop/locations/:id", update, async (request, reply) => {
    await deleteLocation(server.database, readIdParam(request.params, "location"));
    return reply.code(204).send();
  });
}
