import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { STYLESHEET_FOLDER } from "./site-context.service.js";
import { findSiteForAddress } from "./site-for-address.js";
import { readSiteContext, respondToSitePath, type SiteDependencies } from "./site-pages.service.js";

/**
 * HTTP only, on the website's own server (see site-server.ts):
 *
 *   GET /_lintel/site-<fingerprint>.css   the theme and component styles, cached for a year
 *   GET /*                                 a page, a redirect, sitemap.xml, robots.txt or 404
 *
 * `?preview=<token>` on any page shows a draft (see site-preview.service.ts). Each visit is
 * for the site whose domain (and path prefix) it came to, else the default site
 * (see site-for-address.ts).
 */

const pageQuerySchema = z.object({ preview: z.string().min(1).optional() }).catch({});

export async function siteRoutes(
  server: FastifyInstance,
  options: {
    database: () => DatabaseOrTransaction;
    dependencies: (site: Site) => SiteDependencies;
  },
) {
  const visit = async (request: FastifyRequest) => {
    const pathname = request.url.split("?")[0] ?? "/";
    const { site, path } = await findSiteForAddress(options.database(), {
      host: requestHost(request),
      path: pathname,
    });
    return { dependencies: options.dependencies(site), path };
  };

  server.get(`${STYLESHEET_FOLDER}/:file`, async (request, reply) => {
    const context = await readSiteContext((await visit(request)).dependencies);
    // An older fingerprint still gets today's styles, but only the current one is kept long.
    const isCurrent = request.url.split("?")[0] === context.stylesheet.path;
    return reply
      .type("text/css; charset=utf-8")
      .header("cache-control", isCurrent ? "public, max-age=31536000, immutable" : "no-cache")
      .send(context.stylesheet.css);
  });

  server.get("/*", async (request, reply) => {
    const { dependencies, path } = await visit(request);
    const { preview } = pageQuerySchema.parse(request.query);
    const response = await respondToSitePath(dependencies, path, preview);
    // Shared caches must keep each site's pages apart.
    reply.header("vary", "Host, X-Forwarded-Host");
    return send(request, reply, response);
  });
}

/** The domain the visitor asked for. A proxy in front of the website passes it on. */
function requestHost(request: FastifyRequest): string | undefined {
  const forwarded = request.headers["x-forwarded-host"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || request.headers.host;
}

function send(request: FastifyRequest, reply: FastifyReply, response: SiteResponse) {
  reply.headers(response.headers);
  const etag = response.headers.etag;
  if (etag && response.statusCode === 200 && request.headers["if-none-match"] === etag) {
    return reply.code(304).send();
  }
  return reply.code(response.statusCode).send(response.body);
}
