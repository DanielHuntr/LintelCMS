import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import {
  EFFECTS_FOLDER,
  FONTS_FOLDER,
  ILLUSTRATIONS_FOLDER,
  readCookieNoticeScript,
  readEffectFile,
  readElementsScript,
  readFontFile,
  readIllustration,
  readMotionRuntime,
} from "./site-assets.js";
import { withAnalyticsTag } from "../analytics/page-tag.js";
import { STYLESHEET_FOLDER } from "./site-context.service.js";
import { findSiteForAddress } from "./site-for-address.js";
import { loadRunningTests, visitTests } from "../experiments/experiment-pages.js";
import { testsScript } from "../experiments/tests-script.js";
import { readVisitor } from "../experiments/visitor-assignment.js";
import { FORM_SCRIPT_PATH, formTokenScript } from "./site-forms.service.js";
import { readSiteContext, respondToSitePath, type SiteDependencies } from "./site-pages.service.js";

/**
 * HTTP only, on the website's own server (see site-server.ts):
 *
 *   GET /_lintel/site-<fingerprint>.css   the theme and component styles, cached for a year
 *   GET /_lintel/motion-<fingerprint>.js  the motion runtime, for pages with animations
 *   GET /_lintel/elements-<fingerprint>.js the elements script, for sliders, forms, the shop
 *   GET /_lintel/cookie-notice-<fingerprint>.js the cookie notice, on sites that show one
 *   GET /_lintel/effects/<module>-<fingerprint>.js an effect module or a chunk they share
 *   ALL /_lintel/api/shop/*, /forms/*, /analytics/*  the storefront, forms and Visitors APIs (site-api.routes.ts)
 *   GET /_lintel/illustrations/<name>.svg the starter sites' illustrations
 *   GET /_lintel/fonts/<file>.woff2       the fonts that come with Lintel
 *   GET /_lintel/forms.js                 fetches forms' anti-spam tokens
 *   GET /*                                 a page, a redirect, sitemap.xml, robots.txt or 404
 *
 * `?preview=<token>` on any page shows a draft (see site-preview.service.ts). Each visit is
 * for the site whose domain (and path prefix) it came to, else the default site
 * (see site-for-address.ts).
 */

const pageQuerySchema = z
  .object({
    preview: z.string().min(1).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
    sort: z
      .string()
      .regex(/^[A-Za-z]{1,40}$/)
      .optional()
      .catch(undefined),
    q: z.string().trim().max(200).optional().catch(undefined),
  })
  .catch({});

export async function siteRoutes(
  server: FastifyInstance,
  options: {
    database: () => DatabaseOrTransaction;
    dependencies: (site: Site) => SiteDependencies;
    /** A line for public pages' `<head>`, added as they are sent (the Visitors beacon). */
    pageTag?: (site: Site) => Promise<string>;
  },
) {
  const visit = async (request: FastifyRequest) => {
    const pathname = request.url.split("?")[0] ?? "/";
    const host = requestHost(request);
    const { site, path } = await findSiteForAddress(options.database(), { host, path: pathname });
    return { dependencies: { ...options.dependencies(site), host }, path };
  };

  server.get(`${ILLUSTRATIONS_FOLDER}/:file`, async (request, reply) => {
    const { file } = request.params as { file: string };
    const svg = readIllustration(file);
    if (!svg) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Not found");
    }
    return reply
      .type("image/svg+xml")
      .header("cache-control", "public, max-age=86400")
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
      .send(svg);
  });

  server.get(`${EFFECTS_FOLDER}/:file`, async (request, reply) => {
    const { file } = request.params as { file: string };
    const code = readEffectFile(file);
    if (code === undefined) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Not found");
    }
    // Modules are imported across origins by the builder's canvas, so anyone may load them.
    return reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("access-control-allow-origin", "*")
      .send(code);
  });

  server.get(`${FONTS_FOLDER}/:file`, async (request, reply) => {
    const { file } = request.params as { file: string };
    const font = readFontFile(file);
    if (!font) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Not found");
    }
    // Any address may use them: the builder's canvas loads them from another origin.
    return reply
      .type("font/woff2")
      .header("cache-control", "public, max-age=604800")
      .header("access-control-allow-origin", "*")
      .send(font);
  });

  server.get(FORM_SCRIPT_PATH, async (_request, reply) =>
    reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .send(formTokenScript),
  );

  server.get(`${STYLESHEET_FOLDER}/:file`, async (request, reply) => {
    const path = request.url.split("?")[0];
    const script = [
      readMotionRuntime(),
      readElementsScript(),
      readCookieNoticeScript(),
      testsScript,
    ].find((candidate) => candidate?.path === path);
    if (script) {
      return reply
        .type("text/javascript; charset=utf-8")
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(script.code);
    }
    // The look is shared by every site; the site here only decides which cache keeps it.
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
    const { preview, page, sort, q } = pageQuerySchema.parse(request.query);
    // Running A/B tests, shared until something changes, and this visitor's versions of them.
    const tests = await dependencies.cache.shareValue("experiments", () =>
      loadRunningTests(dependencies.database),
    );
    const experiments = visitTests(tests, readVisitor(request.headers, request.ip));
    const response = await respondToSitePath({ ...dependencies, experiments }, path, preview, {
      page: page ?? 1,
      sort,
      search: q,
    });
    // Shared caches must keep each site's pages apart.
    reply.header("vary", "Host, X-Forwarded-Host");
    const tag = options.pageTag ? await options.pageTag(dependencies.site) : "";
    return send(request, reply, withAnalyticsTag(response, tag));
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
