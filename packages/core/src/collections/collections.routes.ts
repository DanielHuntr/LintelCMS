import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  collectionHandleParamsSchema,
  createCollectionRequestSchema,
  updateCollectionRequestSchema,
} from "./collections.schema.js";
import {
  createCollection,
  deleteCollection,
  findCollection,
  listCollections,
  updateCollection,
} from "./collections.service.js";

/**
 * HTTP only:
 *
 *   GET    /collections          (collections:read)    -> { collections: [Collection] }
 *   GET    /collections/:handle  (collections:read)    -> Collection
 *   POST   /collections          (collections:update)  -> 201 Collection
 *   PUT    /collections/:handle  (collections:update)  -> Collection
 *   DELETE /collections/:handle  (collections:update)  -> 204, or 409 COLLECTION_NOT_EMPTY
 */
export async function collectionsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("collections:read") };
  const canUpdate = { preHandler: requirePermission("collections:update") };

  server.get("/collections", canRead, async () => listCollections(server.database));

  server.get("/collections/:handle", canRead, async (request) => {
    const { handle } = parseRequest(collectionHandleParamsSchema, request.params);
    return findCollection(server.database, handle);
  });

  server.post("/collections", canUpdate, async (request, reply) => {
    const collection = parseRequest(createCollectionRequestSchema, request.body);
    return reply.code(201).send(await createCollection(server.database, collection));
  });

  server.put("/collections/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(collectionHandleParamsSchema, request.params);
    const changes = parseRequest(updateCollectionRequestSchema, request.body);
    return updateCollection(server.database, handle, changes);
  });

  server.delete("/collections/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(collectionHandleParamsSchema, request.params);
    await deleteCollection(server.database, handle);
    return reply.code(204).send();
  });
}
