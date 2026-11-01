import type { PublicSite } from "../production/public-site.js";
import { siteApiRoutes } from "./site-api.routes.js";
import { storefrontSources } from "./site-sources.js";
import { siteRoutes } from "./site.routes.js";

/**
 * The built-in website in production: the same pages `pnpm dev` serves on SITE_PORT, at
 * every address the API (/api) and the admin (ADMIN_PATH) don't use, on the one server
 * `pnpm start` runs (see src/production). It reads through that server's database, media
 * lookup and rendered pages cache, so it always follows what editors publish.
 */
export const builtInPublicSite: PublicSite = async (server, options) => {
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error, "Showing a page of the website failed");
    return reply
      .code(500)
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Something went wrong</title></head>' +
          "<body><h1>Something went wrong</h1><p>Please try again in a moment.</p></body></html>",
      );
  });

  // An address under /api that isn't an API route is the API's 404, not a website page.
  server.addHook("onRequest", async (request, reply) => {
    if (request.url === options.apiPrefix || request.url.startsWith(`${options.apiPrefix}/`)) {
      return reply.callNotFound();
    }
    return undefined;
  });

  // The basket and forms on the website's pages talk to the API through /_lintel/api, and
  // shop and form elements read it, all inside this one process (see site-sources.ts).
  const sources = storefrontSources(server, options.apiPrefix);
  await server.register(siteApiRoutes, { api: server, apiPrefix: options.apiPrefix });
  await server.register(siteRoutes, {
    database: () => server.database,
    // Each site has its own pages, so each reads and caches its own (see site-for-address.ts).
    dependencies: (site) => ({
      sources,
      database: server.database,
      assetLookup: server.assetLookup,
      templates: server.website.templates,
      builtInSiteUrl: server.website.builtInSiteUrl,
      site,
      cache: server.website.renderedPages.forSite(site.id),
    }),
  });
};
