import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { localeQuerySchema } from "../sites/locales.schema.js";
import { deliverAllGlobalSets, deliverGlobalSet } from "./globals-delivery.service.js";
import {
  createGlobalSetRequestSchema,
  globalSetParamsSchema,
  saveGlobalValuesRequestSchema,
  updateGlobalSetRequestSchema,
} from "./globals.schema.js";
import {
  createGlobalSet,
  deleteGlobalSet,
  findGlobalSet,
  listGlobalSets,
  saveGlobalValues,
  updateGlobalSet,
} from "./globals.service.js";

/**
 * HTTP only. Changing a set's fields needs the same permission as changing a content type.
 *
 *   GET    /globals                        (globals:read)       -> { globals: [GlobalSetSummary] }
 *   POST   /globals                        (blueprints:update)  { handle, name, fields? } -> 201
 *   GET    /globals/:handle                (globals:read)       ?locale -> GlobalSet
 *   PUT    /globals/:handle                (blueprints:update)  { name, fields } -> GlobalSet
 *   PATCH  /globals/:handle/values         (globals:update)     ?locale { data } -> GlobalSet
 *   DELETE /globals/:handle                (blueprints:update)  -> 204
 *   GET    /delivery/globals               (public)             ?locale -> { locale, globals }
 *   GET    /delivery/globals/:handle       (public)             ?locale -> DeliveredGlobalSet
 */
export async function globalsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("globals:read") };
  const canUpdateValues = { preHandler: requirePermission("globals:update") };
  const canChangeFields = { preHandler: requirePermission("blueprints:update") };

  server.get("/globals", canRead, async () => listGlobalSets(server.database));

  server.post("/globals", canChangeFields, async (request, reply) => {
    const globalSet = parseRequest(createGlobalSetRequestSchema, request.body);
    return reply.code(201).send(await createGlobalSet(server.database, globalSet));
  });

  server.get("/globals/:handle", canRead, async (request) => {
    const { handle } = parseRequest(globalSetParamsSchema, request.params);
    const { locale } = parseRequest(localeQuerySchema, request.query);
    return findGlobalSet(server.database, handle, locale);
  });

  server.put("/globals/:handle", canChangeFields, async (request) => {
    const { handle } = parseRequest(globalSetParamsSchema, request.params);
    const changes = parseRequest(updateGlobalSetRequestSchema, request.body);
    return updateGlobalSet(server.database, handle, changes);
  });

  server.patch("/globals/:handle/values", canUpdateValues, async (request) => {
    const { handle } = parseRequest(globalSetParamsSchema, request.params);
    const { locale } = parseRequest(localeQuerySchema, request.query);
    const values = parseRequest(saveGlobalValuesRequestSchema, request.body);
    return saveGlobalValues(server.database, handle, locale, values, {
      authorId: getSignedIn(request).user.id,
      assetExists: server.assetExists,
    });
  });

  server.delete("/globals/:handle", canChangeFields, async (request, reply) => {
    const { handle } = parseRequest(globalSetParamsSchema, request.params);
    await deleteGlobalSet(server.database, handle);
    return reply.code(204).send();
  });

  server.get("/delivery/globals", async (request, reply) => {
    const { locale } = parseRequest(localeQuerySchema, request.query);
    const globals = await deliverAllGlobalSets(server.database, locale, server.assetLookup);
    return reply.header("cache-control", "public, max-age=60").send(globals);
  });

  server.get("/delivery/globals/:handle", async (request, reply) => {
    const { handle } = parseRequest(globalSetParamsSchema, request.params);
    const { locale } = parseRequest(localeQuerySchema, request.query);
    const globalSet = await deliverGlobalSet(server.database, handle, locale, server.assetLookup);
    return reply.header("cache-control", "public, max-age=60").send(globalSet);
  });
}
