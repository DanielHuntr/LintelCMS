import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import { createMarketRequestSchema, updateMarketRequestSchema } from "./markets.schema.js";
import {
  createMarket,
  deleteMarket,
  describeMarket,
  findMarket,
  listMarkets,
  updateMarket,
} from "./markets.service.js";

/**
 * HTTP only:
 *
 *   GET    /shop/markets        (commerce:read)    -> { markets }
 *   POST   /shop/markets        (commerce:update)  { name, currency, countries, ... } -> 201
 *   GET    /shop/markets/:id    (commerce:read)
 *   PATCH  /shop/markets/:id    (commerce:update)  any field, or { isPrimary: true }
 *   DELETE /shop/markets/:id    (commerce:update)  -> 204; the primary market can't be deleted
 */
export async function marketsRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/markets", read, async () => listMarkets(server.database));

  server.post("/shop/markets", update, async (request, reply) => {
    const market = parseRequest(createMarketRequestSchema, request.body);
    return reply.code(201).send(await createMarket(server.database, market));
  });

  server.get("/shop/markets/:id", read, async (request) =>
    describeMarket(await findMarket(server.database, readMarketId(request.params))),
  );

  server.patch("/shop/markets/:id", update, async (request) => {
    const changes = parseRequest(updateMarketRequestSchema, request.body);
    return updateMarket(server.database, readMarketId(request.params), changes);
  });

  server.delete("/shop/markets/:id", update, async (request, reply) => {
    await deleteMarket(server.database, readMarketId(request.params));
    return reply.code(204).send();
  });
}

function readMarketId(params: unknown): string {
  return readIdParam(params, "market");
}
