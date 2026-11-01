import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * The cookie that carries the session token.
 *
 * - httpOnly: page scripts can't read it, so an XSS bug can't steal sessions.
 * - SameSite=Lax: other sites can't make the browser send it with their form posts.
 * - Secure outside development: it only travels over HTTPS.
 * - The `__Host-` prefix (whenever it is Secure): browsers only accept the cookie from this
 *   exact host, with no Domain and Path=/. A page on another subdomain of the same site
 *   can't plant its own session cookie here to sign an editor in as someone else.
 *
 * Plain-HTTP development can't use the prefix (browsers require Secure for it), so it uses
 * the plain name instead.
 */
export const SESSION_COOKIE_NAME = "__Host-lintel_session";
export const DEVELOPMENT_SESSION_COOKIE_NAME = "lintel_session";

export function sessionCookieName(secureCookies: boolean): string {
  return secureCookies ? SESSION_COOKIE_NAME : DEVELOPMENT_SESSION_COOKIE_NAME;
}

export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[sessionCookieName(request.server.secureCookies)] || undefined;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(sessionCookieName(reply.server.secureCookies), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: reply.server.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(sessionCookieName(reply.server.secureCookies), {
    httpOnly: true,
    sameSite: "lax",
    secure: reply.server.secureCookies,
    path: "/",
  });
}
