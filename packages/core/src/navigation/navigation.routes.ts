import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { localeQuerySchema } from "../sites/locales.schema.js";
import { deliverNavigation } from "./navigation-delivery.service.js";
import {
  createNavigationRequestSchema,
  navigationParamsSchema,
  updateNavigationRequestSchema,
} from "./navigation.schema.js";
import {
  createNavigation,
  deleteNavigation,
  findNavigation,
  listNavigations,
  updateNavigation,
} from "./navigation.service.js";

/**
 * HTTP only:
 *
 *   GET    /navigation                  (navigation:read)    -> { navigations: [Summary] }
 *   POST   /navigation                  (navigation:update)  { handle, name, maxDepth? } -> 201
 *   GET    /navigation/:handle          (navigation:read)    -> Navigation
 *   PUT    /navigation/:handle          (navigation:update)  { name?, maxDepth?, items? }
 *   DELETE /navigation/:handle          (navigation:update)  -> 204
 *   GET    /delivery/navigation/:handle (public)             ?locale -> the menu, ready to print
 */
export async function navigationRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("navigation:read") };
  const canUpdate = { preHandler: requirePermission("navigation:update") };

  server.get("/navigation", canRead, async () => listNavigations(server.database));

  server.post("/navigation", canUpdate, async (request, reply) => {
    const navigation = parseRequest(createNavigationRequestSchema, request.body);
    return reply.code(201).send(await createNavigation(server.database, navigation));
  });

  server.get("/navigation/:handle", canRead, async (request) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    return findNavigation(server.database, handle);
  });

  server.put("/navigation/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    const changes = parseRequest(updateNavigationRequestSchema, request.body);
    return updateNavigation(server.database, handle, changes);
  });

  server.delete("/navigation/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    await deleteNavigation(server.database, handle);
    return reply.code(204).send();
  });

  server.get("/delivery/navigation/:handle", async (request, reply) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    const { locale } = parseRequest(localeQuerySchema, request.query);
    const navigation = await deliverNavigation(server.database, handle, locale);
    return reply.header("cache-control", "public, max-age=60").send(navigation);
  });
}
