import type { FastifyInstance } from "fastify";
import { requireDeliveryAccess } from "../delivery/require-delivery-access.js";
import { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { checkSiteAccess, resolveDeliverySite } from "./request-site.js";
import { listRoleSiteAccess, setRoleSiteAccess } from "./site-access.service.js";
import { matchSiteForAddress, removePathPrefix } from "./site-addresses.js";
import {
  createSite,
  deleteSite,
  deliverSite,
  findSite,
  listDeliveredSites,
  listSites,
  updateSite,
} from "./site-management.service.js";
import {
  createSiteRequestSchema,
  matchSiteQuerySchema,
  roleParamsSchema,
  roleSiteAccessRequestSchema,
  siteParamsSchema,
  updateSiteRequestSchema,
} from "./sites.schema.js";
import { NoSiteForAddressError } from "./sites.errors.js";
import { findSiteOrFail, isDefaultSite, listAllSites } from "./sites.service.js";

const WEBSITE_CACHE = "public, max-age=60";

/**
 * HTTP only:
 *
 *   GET    /sites                      (signed in)        -> { sites: [Site] } they may work on
 *   POST   /sites                      (settings:update)  { handle, name, defaultLocale, ... } -> 201
 *   GET    /sites/:handle              (settings:read)    -> Site
 *   PATCH  /sites/:handle              (settings:update)  { name?, hostnames?, pathPrefix?, ... }
 *   DELETE /sites/:handle              (settings:update)  -> 204, or 409 DEFAULT_SITE / SITE_HAS_ENTRIES
 *   GET    /sites/access               (settings:read)    -> { roles: [{ handle, name, siteHandles }] }
 *   PUT    /sites/access/:roleHandle   (settings:update and roles:update)  { siteHandles: [..] | null }
 *
 * Someone limited to some sites can only change those sites, and only move roles among them
 * (see site-access.service.ts).
 *
 * For websites, open unless delivery needs a token (Build → API access):
 *
 *   GET /delivery/sites                -> { sites: [DeliveredSite] }
 *   GET /delivery/site                 -> the site this request is for (?site=, header or domain)
 *   GET /delivery/sites/match?url=     -> { site, path } for a full address, or 404
 */
export async function sitesRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("settings:read") };
  const canUpdate = { preHandler: requirePermission("settings:update") };
  // Which sites a role works on is part of the role, so it needs both.
  const canChangeRoles = {
    preHandler: [requirePermission("settings:update"), requirePermission("roles:update")],
  };

  server.get("/sites", { preHandler: requireSignedIn }, async (request) =>
    listSites(server.database, getSignedIn(request).siteIds ?? null),
  );

  server.post("/sites", canUpdate, async (request, reply) => {
    const site = parseRequest(createSiteRequestSchema, request.body);
    return reply.code(201).send(await createSite(server.database, site));
  });

  // Registered before /sites/:handle reads "access" as a handle; fixed paths win anyway.
  server.get("/sites/access", canRead, async () => listRoleSiteAccess(server.database));

  server.put("/sites/access/:roleHandle", canChangeRoles, async (request) => {
    const { roleHandle } = parseRequest(roleParamsSchema, request.params);
    const { siteHandles } = parseRequest(roleSiteAccessRequestSchema, request.body);
    return setRoleSiteAccess(server.database, getSignedIn(request), roleHandle, siteHandles);
  });

  server.get("/sites/:handle", canRead, async (request) => {
    const { handle } = parseRequest(siteParamsSchema, request.params);
    return findSite(server.database, handle);
  });

  server.patch("/sites/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(siteParamsSchema, request.params);
    const changes = parseRequest(updateSiteRequestSchema, request.body);
    checkSiteAccess(getSignedIn(request), await findSiteOrFail(server.database, handle));
    return updateSite(server.database, handle, changes);
  });

  server.delete("/sites/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(siteParamsSchema, request.params);
    checkSiteAccess(getSignedIn(request), await findSiteOrFail(server.database, handle));
    await deleteSite(server.database, handle);
    return reply.code(204).send();
  });

  // Like the rest of /delivery: open to websites unless delivery needs a token.
  const publicContent = { preHandler: requireDeliveryAccess };

  server.get("/delivery/sites", publicContent, async (_request, reply) =>
    reply.header("cache-control", WEBSITE_CACHE).send(await listDeliveredSites(server.database)),
  );

  server.get("/delivery/site", publicContent, async (request, reply) => {
    const site = await resolveDeliverySite(request, reply);
    return reply
      .header("cache-control", WEBSITE_CACHE)
      .send(deliverSite(await findSite(server.database, site.handle)));
  });

  server.get("/delivery/sites/match", publicContent, async (request, reply) => {
    const { url } = parseRequest(matchSiteQuerySchema, request.query);
    const address = new URL(url);
    const sites = await listAllSites(server.database);
    const site = matchSiteForAddress(
      sites,
      { host: address.host, path: address.pathname },
      sites.find(isDefaultSite),
    );
    if (!site) {
      throw new NoSiteForAddressError(address.host);
    }
    return reply.header("cache-control", WEBSITE_CACHE).send({
      site: deliverSite(await findSite(server.database, site.handle)),
      path: removePathPrefix(site.pathPrefix, address.pathname),
    });
  });
}
