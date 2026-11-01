import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import {
  createShippingRateRequestSchema,
  createShippingZoneRequestSchema,
  updateShippingRateRequestSchema,
  updateShippingZoneRequestSchema,
} from "./shipping.schema.js";
import {
  createShippingRate,
  createShippingZone,
  deleteShippingRate,
  deleteShippingZone,
  listShippingZones,
  updateShippingRate,
  updateShippingZone,
} from "./shipping.service.js";

/**
 * HTTP only:
 *
 *   GET    /shop/shipping/zones             (commerce:read)    -> { zones: [{ ..., rates }] }
 *   POST   /shop/shipping/zones             (commerce:update)  { name, countries } -> 201
 *   PATCH  /shop/shipping/zones/:id         (commerce:update)  { name?, countries? }
 *   DELETE /shop/shipping/zones/:id         (commerce:update)  -> 204, its rates too
 *   POST   /shop/shipping/zones/:id/rates   (commerce:update)  a rate -> 201 the zone
 *   PATCH  /shop/shipping/rates/:id         (commerce:update)  any of a rate's fields -> the zone
 *   DELETE /shop/shipping/rates/:id         (commerce:update)  -> 204
 */
export async function shippingRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/shipping/zones", read, async () => listShippingZones(server.database));

  server.post("/shop/shipping/zones", update, async (request, reply) => {
    const zone = parseRequest(createShippingZoneRequestSchema, request.body);
    return reply.code(201).send(await createShippingZone(server.database, zone));
  });

  server.patch("/shop/shipping/zones/:id", update, async (request) => {
    const changes = parseRequest(updateShippingZoneRequestSchema, request.body);
    return updateShippingZone(
      server.database,
      readIdParam(request.params, "shipping zone"),
      changes,
    );
  });

  server.delete("/shop/shipping/zones/:id", update, async (request, reply) => {
    await deleteShippingZone(server.database, readIdParam(request.params, "shipping zone"));
    return reply.code(204).send();
  });

  server.post("/shop/shipping/zones/:id/rates", update, async (request, reply) => {
    const rate = parseRequest(createShippingRateRequestSchema, request.body);
    const zone = await createShippingRate(
      server.database,
      readIdParam(request.params, "shipping zone"),
      rate,
    );
    return reply.code(201).send(zone);
  });

  server.patch("/shop/shipping/rates/:id", update, async (request) => {
    const changes = parseRequest(updateShippingRateRequestSchema, request.body);
    return updateShippingRate(
      server.database,
      readIdParam(request.params, "shipping rate"),
      changes,
    );
  });

  server.delete("/shop/shipping/rates/:id", update, async (request, reply) => {
    await deleteShippingRate(server.database, readIdParam(request.params, "shipping rate"));
    return reply.code(204).send();
  });
}
