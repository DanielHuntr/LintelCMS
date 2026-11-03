import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * HTTP only, on the website's own server: the storefront and forms APIs at the website's own
 * address, so the basket and forms on its pages need no other origin, no CORS and no API
 * address in the page.
 *
 *   ALL /_lintel/api/shop/*   -> /delivery/shop/*
 *   ALL /_lintel/api/forms/*  -> /delivery/forms/*
 *   ALL /_lintel/api/analytics/*  -> /delivery/analytics/*  (the Visitors plugin's beacon)
 *   ALL /_lintel/api/addons/*  -> /delivery/add-ons/*  (add-ons' public routes, such as a
 *                                 newsletter sign-up; see ADDON_PUBLIC_PREFIX)
 *
 * Requests are passed to the API inside the process (`inject`) with their body, content
 * type, privacy signals and the visitor's address (as the request's own, so per-address
 * limits count each visitor apart), and the answers come back as they are, uncached, except
 * the beacon script and add-ons' answers that say how long to keep them.
 */

const forwardedHeaders = [
  "content-type",
  "accept",
  "user-agent",
  "accept-language",
  "dnt",
  "sec-gpc",
] as const;

type Area = "shop" | "forms" | "analytics" | "addons";

/**
 * Where an add-on's routes for visitors live on the API: `/delivery/add-ons/<add-on id>/...`.
 * Its pages reach them at their own address, `/_lintel/api/addons/<add-on id>/...`. The dash
 * keeps them apart from collections, whose handles can't contain one.
 */
export const ADDON_PUBLIC_PREFIX = "/delivery/add-ons";

const apiPathFor: Record<Area, string> = {
  shop: "/delivery/shop",
  forms: "/delivery/forms",
  analytics: "/delivery/analytics",
  addons: ADDON_PUBLIC_PREFIX,
};

export async function siteApiRoutes(
  server: FastifyInstance,
  options: { api: FastifyInstance; apiPrefix?: string },
) {
  // Bodies are passed on untouched (JSON, form posts and file uploads alike).
  server.removeAllContentTypeParsers();
  server.addContentTypeParser(
    "*",
    { parseAs: "buffer", bodyLimit: 26 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );

  const forward = async (request: FastifyRequest, reply: FastifyReply, area: Area) => {
    const rest = request.url.slice(`/_lintel/api/${area}`.length);
    const headers: Record<string, string> = { "x-forwarded-for": request.ip };
    for (const name of forwardedHeaders) {
      const value = request.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    const response = await options.api.inject({
      method: request.method as "GET",
      url: `${options.apiPrefix ?? ""}${apiPathFor[area]}${rest}`,
      headers,
      remoteAddress: request.ip,
      payload: Buffer.isBuffer(request.body) ? request.body : undefined,
    });
    const passed = ["content-type", "location"] as const;
    for (const name of passed) {
      const value = response.headers[name];
      if (typeof value === "string") reply.header(name, value);
    }
    const cacheControl = response.headers["cache-control"];
    // The beacon script and add-ons' answers (a feed's pictures, say) keep their own caching.
    const keepsCaching =
      (area === "analytics" || area === "addons") && typeof cacheControl === "string";
    return reply
      .code(response.statusCode)
      .header("cache-control", keepsCaching ? cacheControl : "no-store")
      .send(response.rawPayload);
  };

  for (const area of ["shop", "forms", "analytics", "addons"] as const) {
    server.all(`/_lintel/api/${area}`, (request, reply) => forward(request, reply, area));
    server.all(`/_lintel/api/${area}/*`, (request, reply) => forward(request, reply, area));
  }
}
