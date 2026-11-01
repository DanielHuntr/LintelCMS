import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { STYLESHEET_FOLDER } from "./site-context.service.js";
import { FORM_SCRIPT_PATH, formTokenScript } from "./site-forms.service.js";
import { readSiteContext, respondToSitePath, type SiteDependencies } from "./site-pages.service.js";

/**
 * HTTP only, on the website's own server (see site-server.ts):
 *
 *   GET /_lintel/site-<fingerprint>.css   the theme and component styles, cached for a year
 *   GET /_lintel/forms.js                 fetches forms' anti-spam tokens
 *   GET /*                                 a page, a redirect, sitemap.xml, robots.txt or 404
 *
 * `?preview=<token>` on any page shows a draft (see site-preview.service.ts).
 */

const pageQuerySchema = z.object({ preview: z.string().min(1).optional() }).catch({});

export async function siteRoutes(
  server: FastifyInstance,
  options: { dependencies: () => SiteDependencies },
) {
  server.get(FORM_SCRIPT_PATH, async (_request, reply) =>
    reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(formTokenScript),
  );

  server.get(`${STYLESHEET_FOLDER}/:file`, async (request, reply) => {
    const context = await readSiteContext(options.dependencies());
    // An older fingerprint still gets today's styles, but only the current one is kept long.
    const isCurrent = request.url.split("?")[0] === context.stylesheet.path;
    return reply
      .type("text/css; charset=utf-8")
      .header("cache-control", isCurrent ? "public, max-age=31536000, immutable" : "no-cache")
      .send(context.stylesheet.css);
  });

  server.get("/*", async (request, reply) => {
    const pathname = request.url.split("?")[0] ?? "/";
    const { preview } = pageQuerySchema.parse(request.query);
    const response = await respondToSitePath(options.dependencies(), pathname, preview);
    return send(request, reply, response);
  });
}

function send(request: FastifyRequest, reply: FastifyReply, response: SiteResponse) {
  reply.headers(response.headers);
  const etag = response.headers.etag;
  if (etag && response.statusCode === 200 && request.headers["if-none-match"] === etag) {
    return reply.code(304).send();
  }
  return reply.code(response.statusCode).send(response.body);
}
