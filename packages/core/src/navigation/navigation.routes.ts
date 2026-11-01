import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { localeQuerySchema } from "../sites/locales.schema.js";
import { resolveDeliverySite, resolveEditingSite } from "../sites/request-site.js";
import { deliverNavigation } from "./navigation-delivery.service.js";
import {
  createNavigationRequestSchema,
  navigationParamsSchema,
  pageInMenuParamsSchema,
  pageInMenuRequestSchema,
  updateNavigationRequestSchema,
} from "./navigation.schema.js";
import { findPageInMenu, setPageInMenu } from "./navigation-pages.service.js";
import {
  createNavigation,
  deleteNavigation,
  findNavigation,
  listNavigations,
  updateNavigation,
} from "./navigation.service.js";
import { requireDeliveryAccess } from "../delivery/require-delivery-access.js";

/**
 * HTTP only:
 *
 *   GET    /navigation                  (navigation:read)    -> { navigations: [Summary] }
 *   POST   /navigation                  (navigation:update)  { handle, name, maxDepth? } -> 201
 *   GET    /navigation/:handle          (navigation:read)    -> Navigation
 *   PUT    /navigation/:handle          (navigation:update)  { name?, maxDepth?, items?, source?, pageTree? }
 *   GET    /navigation/:handle/pages/:entryId (navigation:read)   -> { menu, inMenu, label }
 *   PUT    /navigation/:handle/pages/:entryId (navigation:update) { inMenu, label? } -> the same
 *   DELETE /navigation/:handle          (navigation:update)  -> 204
 *   GET    /delivery/navigation/:handle (public)             ?locale -> the menu, ready to print
 *
 * Menus belong to a site: the admin's current one, or for websites the one asked for.
 */
export async function navigationRoutes(server: FastifyInstance) {
  // Published content, open to websites unless delivery needs a token (Settings → API access).
  const publicContent = { preHandler: requireDeliveryAccess };
  const canRead = { preHandler: requirePermission("navigation:read") };
  const canUpdate = { preHandler: requirePermission("navigation:update") };

  server.get("/navigation", canRead, async (request) =>
    listNavigations(server.database, await resolveEditingSite(request)),
  );

  server.post("/navigation", canUpdate, async (request, reply) => {
    const navigation = parseRequest(createNavigationRequestSchema, request.body);
    const site = await resolveEditingSite(request);
    return reply.code(201).send(await createNavigation(server.database, navigation, site));
  });

  server.get("/navigation/:handle", canRead, async (request) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    return findNavigation(server.database, handle, await resolveEditingSite(request));
  });

  server.put("/navigation/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    const changes = parseRequest(updateNavigationRequestSchema, request.body);
    return updateNavigation(server.database, handle, changes, await resolveEditingSite(request));
  });

  server.get("/navigation/:handle/pages/:entryId", canRead, async (request) => {
    const { handle, entryId } = parseRequest(pageInMenuParamsSchema, request.params);
    return findPageInMenu(server.database, handle, entryId, await resolveEditingSite(request));
  });

  server.put("/navigation/:handle/pages/:entryId", canUpdate, async (request) => {
    const { handle, entryId } = parseRequest(pageInMenuParamsSchema, request.params);
    const change = parseRequest(pageInMenuRequestSchema, request.body);
    const site = await resolveEditingSite(request);
    return setPageInMenu(server.database, handle, entryId, change, site);
  });

  server.delete("/navigation/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    await deleteNavigation(server.database, handle, await resolveEditingSite(request));
    return reply.code(204).send();
  });

  server.get("/delivery/navigation/:handle", publicContent, async (request, reply) => {
    const { handle } = parseRequest(navigationParamsSchema, request.params);
    const { locale } = parseRequest(localeQuerySchema, request.query);
    const site = await resolveDeliverySite(request, reply);
    const navigation = await deliverNavigation(server.database, handle, locale, site);
    return reply.header("cache-control", "public, max-age=60").send(navigation);
  });
}
