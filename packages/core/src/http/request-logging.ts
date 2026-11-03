import type { FastifyRequest } from "fastify";

/**
 * What the server log records about each request. Fastify's default records the full URL,
 * and some URLs carry secrets in their query: a preview link's token (`?preview=`,
 * `/preview?token=`), which would let anyone reading the log see unpublished drafts.
 * Those values, and a basket's token in its path, are replaced with "[hidden]". Headers aren't logged at all, so cookies and
 * `Authorization` never reach the log.
 */
const SECRET_QUERY_PARAMETERS = new Set(["token", "preview", "secret", "code", "password", "key"]);

/** Secrets in the path itself: a basket's token opens the shopper's basket (LINTEL-SEC-014). */
const SECRET_PATH_SEGMENTS = /(\/shop\/carts\/)[^/?#]+/;

export function hideSecretsInUrl(address: string): string {
  const url = address.replace(SECRET_PATH_SEGMENTS, "$1[hidden]");
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return url;
  }
  const query = new URLSearchParams(url.slice(queryStart + 1));
  for (const name of [...query.keys()]) {
    if (SECRET_QUERY_PARAMETERS.has(name.toLowerCase())) {
      query.set(name, "[hidden]");
    }
  }
  return `${url.slice(0, queryStart)}?${query.toString()}`;
}

export function describeRequestForLog(request: FastifyRequest) {
  return {
    method: request.method,
    url: hideSecretsInUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
  };
}
