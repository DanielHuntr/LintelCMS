import Fastify, { type FastifyInstance } from "fastify";
import { experimentSiteRoutes } from "../experiments/experiment-site.routes.js";
import { analyticsPlugin } from "../analytics/analytics.plugin.js";
import { readAnalyticsTag } from "../analytics/page-tag.js";
import { type TrustProxy, trustProxyOption } from "../production/production.config.js";
import { siteApiRoutes } from "./site-api.routes.js";
import { siteRoutes } from "./site.routes.js";
import { type SiteSources, storefrontSources } from "./site-sources.js";

/**
 * The built-in website, as its own small server on its own port (3000 unless SITE_PORT
 * says otherwise), in the same process as the API. It reads through the API server's
 * database, media lookup and rendered pages cache, so it always follows the API: the
 * setup screen switching databases, an editor publishing a page. See
 * docs/decisions/0014-built-in-website.md.
 */
export function buildSiteServer(options: {
  api: FastifyInstance;
  logger?: boolean;
  /** Where the shop's products and the forms come from; their APIs by default. */
  sources?: SiteSources;
  /**
   * Which proxies to believe about the visitor's address, as for the API (TRUST_PROXY), so
   * forms, the shop and visitor counts tell visitors behind one proxy apart.
   */
  trustProxy?: TrustProxy;
}) {
  const { api } = options;
  const server = Fastify({
    logger: options.logger ?? false,
    trustProxy: trustProxyOption(options.trustProxy ?? false),
  });

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
  // What tested pages' script reports while an A/B test runs (see src/experiments).
  server.register(experimentSiteRoutes, {
    database: () => api.database,
    measurement: () => api.experiments.measurement,
  });
  server.register(siteRoutes, {
    database: () => api.database,
    // The Visitors plugin's beacon, while it is on (see src/analytics/page-tag.ts).
    pageTag: (site) => readAnalyticsTag(api.database, analyticsPlugin, site),
    // Each site has its own pages, so each reads and caches its own (see site-for-address.ts).
    dependencies: (site) => ({
      sources,
      database: api.database,
      assetLookup: api.assetLookup,
      templates: api.website.templates,
      builtInSiteUrl: api.website.builtInSiteUrl,
      site,
      cache: api.website.renderedPages.forSite(site.id),
      liquidTemplates: api.website.liquidTemplates,
      publicApiUrl: api.publicApiUrl,
    }),
  });

  return server;
}

export type SiteServer = FastifyInstance;
