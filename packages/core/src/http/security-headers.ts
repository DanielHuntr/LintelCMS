import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Headers every API response carries, so browsers treat what the API sends as data and
 * nothing more:
 *
 *   - `X-Content-Type-Options: nosniff`: a JSON response is never guessed to be HTML;
 *   - `Content-Security-Policy` and `X-Frame-Options`: nothing the API sends runs anything,
 *     loads anything, or can be shown inside another site's frame;
 *   - `Referrer-Policy: no-referrer`: links in API responses don't leak the API's addresses;
 *   - `Strict-Transport-Security` once the API is on HTTPS: browsers stop trying plain HTTP.
 *
 * A route that sets its own Content-Security-Policy (uploaded files do) keeps it. HTML pages
 * the API serves on purpose (GraphiQL, in development only) keep running their scripts.
 */
const API_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function addSecurityHeaders(publicApiUrl: string) {
  const servedOverHttps = publicApiUrl.startsWith("https://");

  return async function setSecurityHeaders(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown,
  ): Promise<unknown> {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    const contentType = String(reply.getHeader("content-type") ?? "");
    if (!reply.hasHeader("content-security-policy") && !contentType.startsWith("text/html")) {
      reply.header("content-security-policy", API_SECURITY_POLICY);
    }
    if (servedOverHttps || request.protocol === "https") {
      reply.header("strict-transport-security", `max-age=${ONE_YEAR_IN_SECONDS}`);
    }
    return payload;
  };
}
