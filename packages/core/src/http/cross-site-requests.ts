import type { FastifyRequest } from "fastify";
import { readBearerToken } from "../api-tokens/api-token-secrets.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { isPublicContentPath } from "./cross-origin.js";
import { HttpError } from "./http-errors.js";

/**
 * Protection against cross-site request forgery: another website making an editor's
 * browser send a request that changes something, carried by the editor's session cookie.
 *
 * The session cookie is SameSite=Lax, which already stops most of this. But "site" means
 * the registrable domain, so a page on `blog.example.com` counts as the same site as an
 * admin on `cms.example.com`, and a file upload is a form any page can submit. So every
 * request that can change something must also come from a page we trust:
 *
 *   - `Origin`, which browsers send with every POST, PUT, PATCH and DELETE, must be the
 *     admin's address or the API's own;
 *   - when there is no `Origin` (very old browsers), `Sec-Fetch-Site` must not say the
 *     request came from another site;
 *   - requests with neither header aren't from a browser page, so they can't be forged
 *     this way (scripts, tests and server-to-server calls send none).
 *
 * Requests with an API token are left alone: a browser never adds a token by itself, so
 * whoever sent one meant to. The public content APIs (GraphQL is read-only) are left alone
 * when they come without a session, because websites call them from their own pages.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class CrossSiteRequestRefusedError extends HttpError {
  constructor() {
    super(
      403,
      "CROSS_SITE_REQUEST_REFUSED",
      "This request came from another website, so Lintel refused it. If you were using the admin, reload the page and try again.",
    );
  }
}

export function refuseCrossSiteRequests(trustedOrigins: readonly string[]) {
  const trusted = new Set(trustedOrigins.map((origin) => new URL(origin).origin));

  return async function checkRequestOrigin(request: FastifyRequest): Promise<void> {
    if (SAFE_METHODS.has(request.method)) {
      return;
    }
    if (readBearerToken(request.headers.authorization) !== undefined) {
      return;
    }
    if (isPublicContentPath(request.url) && !readSessionToken(request)) {
      return;
    }
    if (!comesFromTrustedPage(request, trusted)) {
      throw new CrossSiteRequestRefusedError();
    }
  };
}

function comesFromTrustedPage(request: FastifyRequest, trusted: ReadonlySet<string>): boolean {
  const origin = request.headers.origin;
  if (origin !== undefined) {
    return trusted.has(origin);
  }
  const fetchSite = request.headers["sec-fetch-site"];
  return fetchSite === undefined || fetchSite === "same-origin" || fetchSite === "none";
}
