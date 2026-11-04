import type { FastifyInstance } from "fastify";
import { analyticsPlugin } from "../analytics/analytics.plugin.js";
import { readAnalyticsTag } from "../analytics/page-tag.js";
import {
  testCheckoutSiteRoutes,
  testVisitReader,
} from "../commerce/test-checkout/test-checkout-site.routes.js";
import { experimentSiteRoutes } from "../experiments/experiment-site.routes.js";
import { siteApiRoutes } from "./site-api.routes.js";
import { siteRoutes } from "./site.routes.js";
import { type SiteSources, storefrontSources } from "./site-sources.js";

export interface WebsiteRoutesOptions {
  /** The server that holds the database and the API's routes. */
  api: FastifyInstance;
  /** Where the API's routes are on `api`: "" beside the website, "/api" in one process. */
  apiPrefix?: string;
  /** Where the admin is on its origin: "" in development, ADMIN_PATH in production. */
  adminPath?: string;
  /** Where the shop's products and the forms come from; their APIs by default. */
  sources?: SiteSources | undefined;
}

/**
 * Everything the built-in website serves, for both of the servers it runs on: its own port
 * under `pnpm dev` (site-server.ts) and the one production server (built-in-public-site.ts).
 * Anything a website page needs goes here, so it can't work in one and silently not in the
 * other, as the Visitors beacon once did (LINTEL-FUNC-042). website-routes.test.ts checks it.
 */
export function addWebsiteRoutes(server: FastifyInstance, options: WebsiteRoutesOptions): void {
  const { api, apiPrefix = "", adminPath = "" } = options;

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

  // The basket and forms on the website's pages talk to the API through /_lintel/api, and
  // shop and form elements read it, all inside this one process (see site-sources.ts).
  const sources = options.sources ?? storefrontSources(api, apiPrefix);
  server.register(siteApiRoutes, { api, apiPrefix });
  const testCheckout = { api, apiPrefix, adminPath };
  server.register(testCheckoutSiteRoutes, testCheckout);
  // What tested pages' script reports while an A/B test runs (see src/experiments).
  server.register(experimentSiteRoutes, {
    database: () => api.database,
    measurement: () => api.experiments.measurement,
  });
  server.register(siteRoutes, {
    database: () => api.database,
    // The Visitors plugin's beacon, while it is on (see src/analytics/page-tag.ts).
    pageTag: (site) => readAnalyticsTag(api.database, analyticsPlugin, site),
    testVisit: testVisitReader(testCheckout),
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
}
