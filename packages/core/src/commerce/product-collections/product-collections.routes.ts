import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import { productCollectionRequestSchema } from "./product-collections.schema.js";
import {
  createProductCollection,
  deleteProductCollection,
  findProductCollection,
  listProductCollections,
  updateProductCollection,
} from "./product-collections.service.js";

/**
 * HTTP only:
 *
 *   GET    /shop/collections       (commerce:read)    -> { collections }
 *   POST   /shop/collections       (commerce:update)  { title, kind, rules?, productIds? } -> 201
 *   GET    /shop/collections/:id   (commerce:read)    with productIds
 *   PUT    /shop/collections/:id   (commerce:update)  the whole collection
 *   DELETE /shop/collections/:id   (commerce:update)  -> 204; the products stay
 */
export async function productCollectionsRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/collections", read, async () => listProductCollections(server.database));

  server.post("/shop/collections", update, async (request, reply) => {
    const collection = parseRequest(productCollectionRequestSchema, request.body);
    return reply.code(201).send(await createProductCollection(server.database, collection));
  });

  server.get("/shop/collections/:id", read, async (request) =>
    findProductCollection(server.database, readIdParam(request.params, "collection")),
  );

  server.put("/shop/collections/:id", update, async (request) => {
    const collection = parseRequest(productCollectionRequestSchema, request.body);
    return updateProductCollection(
      server.database,
      readIdParam(request.params, "collection"),
      collection,
    );
  });

  server.delete("/shop/collections/:id", update, async (request, reply) => {
    await deleteProductCollection(server.database, readIdParam(request.params, "collection"));
    return reply.code(204).send();
  });
}
