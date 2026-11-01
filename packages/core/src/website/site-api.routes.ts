import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * HTTP only, on the website's own server: the storefront and forms APIs at the website's own
 * address, so the basket and forms on its pages need no other origin, no CORS and no API
 * address in the page.
 *
 *   ALL /_lintel/api/shop/*   -> /delivery/shop/*
 *   ALL /_lintel/api/forms/*  -> /delivery/forms/*
 *
 * Requests are passed to the API inside the process (`inject`) with their body, content
 * type and the visitor's address, and the answers come back as they are, uncached.
 */

const forwardedHeaders = ["content-type", "accept", "user-agent", "accept-language"] as const;

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

  const forward = async (request: FastifyRequest, reply: FastifyReply, area: "shop" | "forms") => {
    const rest = request.url.slice(`/_lintel/api/${area}`.length);
    const headers: Record<string, string> = { "x-forwarded-for": request.ip };
    for (const name of forwardedHeaders) {
      const value = request.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    const response = await options.api.inject({
      method: request.method as "GET",
      url: `${options.apiPrefix ?? ""}/delivery/${area}${rest}`,
      headers,
      payload: Buffer.isBuffer(request.body) ? request.body : undefined,
    });
    const passed = ["content-type", "location"] as const;
    for (const name of passed) {
      const value = response.headers[name];
      if (typeof value === "string") reply.header(name, value);
    }
    return reply
      .code(response.statusCode)
      .header("cache-control", "no-store")
      .send(response.rawPayload);
  };

  for (const area of ["shop", "forms"] as const) {
    server.all(`/_lintel/api/${area}`, (request, reply) => forward(request, reply, area));
    server.all(`/_lintel/api/${area}/*`, (request, reply) => forward(request, reply, area));
  }
}
