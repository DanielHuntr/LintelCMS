import type { FastifyInstance } from "fastify";
import { requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { requireDeliveryAccess } from "../delivery/require-delivery-access.js";
import { EntryNotFoundError } from "../entries/entries.errors.js";
import { parseRequest } from "../http/http-errors.js";
import { deliverEntrySeo, findEntrySeo, saveEntrySeo } from "./entry-seo.service.js";
import {
  createRedirectRequestSchema,
  importRedirectsRequestSchema,
  listRedirectsQuerySchema,
  redirectIdParamsSchema,
  updateRedirectRequestSchema,
} from "./redirects.schema.js";
import {
  createRedirect,
  deleteRedirect,
  importRedirects,
  listDeliveredRedirects,
  listRedirects,
  updateRedirect,
} from "./redirects.service.js";
import { RedirectNotFoundError } from "./seo.errors.js";
import { readSeoDefaults, updateSeoDefaults } from "./seo-defaults.service.js";
import { requireSeoPlugin } from "./seo-plugin.js";
import {
  deliveredEntrySeoParamsSchema,
  entrySeoParamsSchema,
  entrySeoRequestSchema,
  updateSeoDefaultsRequestSchema,
} from "./seo.schema.js";
import { buildRobots, buildSitemap } from "./sitemap.service.js";

/** Search engines may keep these for an hour; a new page appears in the sitemap within it. */
const SEARCH_ENGINE_CACHE = "public, max-age=3600";
const WEBSITE_CACHE = "public, max-age=60";

/**
 * HTTP only. Everything here answers 404 PLUGIN_NOT_ENABLED while the SEO plugin is off.
 *
 *   GET    /seo/defaults                   (signed in)
 *   PUT    /seo/defaults                   (settings:update)  any of the defaults
 *   GET    /seo/entries/:id                (entries:read)
 *   PUT    /seo/entries/:id                (entries:update)   { title, description, socialImageId, noindex }
 *   GET    /seo/redirects                  (settings:read)    ?status=active|suggested
 *   POST   /seo/redirects                  (settings:update)  { fromPath, toPath, statusCode? } -> 201
 *   PATCH  /seo/redirects/:id              (settings:update)  { fromPath?, toPath?, statusCode?, status? }
 *   DELETE /seo/redirects/:id              (settings:update)  -> 204
 *   POST   /seo/redirects/import           (settings:update)  { csv } -> { added, updated, problems }
 *
 * For websites and search engines:
 *
 *   GET /delivery/seo-redirects            the active redirects (delivery access rules apply)
 *   GET /delivery/:collection/:slug/seo    a published entry's finished SEO (the same)
 *   GET /sitemap.xml, GET /robots.txt      always public
 */
export async function seoRoutes(server: FastifyInstance) {
  const can = (permission: `${string}:${string}`) => ({
    preHandler: [requireSeoPlugin, requirePermission(permission)],
  });
  const publicContent = { preHandler: [requireSeoPlugin, requireDeliveryAccess] };

  // Anyone signed in may read the defaults: the editor's search preview needs them.
  server.get("/seo/defaults", { preHandler: [requireSeoPlugin, requireSignedIn] }, async () =>
    readSeoDefaults(server.database),
  );

  server.put("/seo/defaults", can("settings:update"), async (request) => {
    const changes = parseRequest(updateSeoDefaultsRequestSchema, request.body);
    return updateSeoDefaults(server.database, changes);
  });

  server.get("/seo/entries/:id", can("entries:read"), async (request) =>
    findEntrySeo(server.database, readEntryId(request.params)),
  );

  server.put("/seo/entries/:id", can("entries:update"), async (request) => {
    const seo = parseRequest(entrySeoRequestSchema, request.body);
    return saveEntrySeo(server.database, readEntryId(request.params), seo, server.assetExists);
  });

  server.get("/seo/redirects", can("settings:read"), async (request) => {
    const { status } = parseRequest(listRedirectsQuerySchema, request.query);
    return listRedirects(server.database, status);
  });

  server.post("/seo/redirects", can("settings:update"), async (request, reply) => {
    const redirect = parseRequest(createRedirectRequestSchema, request.body);
    return reply.code(201).send(await createRedirect(server.database, redirect));
  });

  server.post("/seo/redirects/import", can("settings:update"), async (request) => {
    const { csv } = parseRequest(importRedirectsRequestSchema, request.body);
    return importRedirects(server.database, csv);
  });

  server.patch("/seo/redirects/:id", can("settings:update"), async (request) => {
    const changes = parseRequest(updateRedirectRequestSchema, request.body);
    return updateRedirect(server.database, readRedirectId(request.params), changes);
  });

  server.delete("/seo/redirects/:id", can("settings:update"), async (request, reply) => {
    await deleteRedirect(server.database, readRedirectId(request.params));
    return reply.code(204).send();
  });

  server.get("/delivery/seo-redirects", publicContent, async (_request, reply) => {
    const redirects = await listDeliveredRedirects(server.database);
    return reply.header("cache-control", WEBSITE_CACHE).send(redirects);
  });

  server.get("/delivery/:collection/:slug/seo", publicContent, async (request, reply) => {
    const { collection, slug } = parseRequest(deliveredEntrySeoParamsSchema, request.params);
    const seo = await deliverEntrySeo(server.database, collection, slug, server.assetLookup);
    return reply.header("cache-control", WEBSITE_CACHE).send(seo);
  });

  server.get("/sitemap.xml", { preHandler: requireSeoPlugin }, async (_request, reply) => {
    const xml = await buildSitemap(server.database);
    return reply
      .type("application/xml; charset=utf-8")
      .header("cache-control", SEARCH_ENGINE_CACHE)
      .send(xml);
  });

  server.get("/robots.txt", { preHandler: requireSeoPlugin }, async (_request, reply) => {
    const text = await buildRobots(server.database);
    return reply
      .type("text/plain; charset=utf-8")
      .header("cache-control", SEARCH_ENGINE_CACHE)
      .send(text);
  });
}

function readEntryId(params: unknown): string {
  const parsed = entrySeoParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new EntryNotFoundError();
  }
  return parsed.data.id;
}

function readRedirectId(params: unknown): string {
  const parsed = redirectIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RedirectNotFoundError();
  }
  return parsed.data.id;
}
