import Fastify, { type FastifyInstance } from "fastify";
import { type TrustProxy, trustProxyOption } from "../production/production.config.js";
import type { SiteSources } from "./site-sources.js";
import { addWebsiteRoutes } from "./website-routes.js";

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
  const server = Fastify({
    logger: options.logger ?? false,
    trustProxy: trustProxyOption(options.trustProxy ?? false),
  });

  addWebsiteRoutes(server, { api: options.api, sources: options.sources });

  return server;
}

export type SiteServer = FastifyInstance;
