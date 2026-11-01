import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import {
  deliveryEntryParamsSchema,
  deliveryListParamsSchema,
  deliveryListQuerySchema,
} from "./delivery.schema.js";
import { findDeliveredEntry, listDeliveredEntries } from "./delivery.service.js";

/**
 * Websites may keep a response for a minute. Short enough that a publish shows up
 * quickly, long enough to take the load off the database for a busy page.
 */
const CACHE_CONTROL = "public, max-age=60";

/**
 * HTTP only. Public by design: no session, published content only (see README.md).
 *
 *   GET /delivery/:collection        ?page&perPage -> { items: [DeliveredEntry], total }
 *   GET /delivery/:collection/:slug  -> DeliveredEntry, or 404
 */
export async function deliveryRoutes(server: FastifyInstance) {
  server.get("/delivery/:collection", async (request, reply) => {
    const { collection } = parseRequest(deliveryListParamsSchema, request.params);
    const query = parseRequest(deliveryListQuerySchema, request.query);
    const list = await listDeliveredEntries(server.database, collection, query, server.assetLookup);
    return reply.header("cache-control", CACHE_CONTROL).send(list);
  });

  server.get("/delivery/:collection/:slug", async (request, reply) => {
    const { collection, slug } = parseRequest(deliveryEntryParamsSchema, request.params);
    const entry = await findDeliveredEntry(server.database, collection, slug, server.assetLookup);
    return reply.header("cache-control", CACHE_CONTROL).send(entry);
  });
}
