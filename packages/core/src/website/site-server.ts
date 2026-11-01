import Fastify, { type FastifyInstance } from "fastify";
import { siteApiRoutes } from "./site-api.routes.js";
import { siteRoutes } from "./site.routes.js";
import { type SiteSources, storefrontSources } from "./site-sources.js";

/**
 * The built-in website, as its own small server on its own port (3000 unless SITE_PORT
 * says otherwise), in the same process as the API. It reads through the API server's
 * database, media lookup and rendered pages cache, so it always follows the API: the
 * setup screen switching databases, an editor publishing a page. See
 * docs/decisions/0011-built-in-website.md.
 */
export function buildSiteServer(options: {
  api: FastifyInstance;
  logger?: boolean;
  /** Where the shop's products and the forms come from; their APIs by default. */
  sources?: SiteSources;
}) {
  const { api } = options;
  const server = Fastify({ logger: options.logger ?? false });

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

  const sources = options.sources ?? storefrontSources(api);
  server.register(siteApiRoutes, { api });
  server.register(siteRoutes, {
    dependencies: () => ({
      sources,
      database: api.database,
      assetLookup: api.assetLookup,
      templates: api.website.templates,
      builtInSiteUrl: api.website.builtInSiteUrl,
      cache: api.website.renderedPages,
    }),
  });

  return server;
}

export type SiteServer = FastifyInstance;
