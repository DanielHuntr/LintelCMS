import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * The cookie that carries the session token.
 *
 * - httpOnly: page scripts can't read it, so an XSS bug can't steal sessions.
 * - SameSite=Lax: other sites can't make the browser send it with their form posts.
 * - Secure outside development: it only travels over HTTPS.
 */
export const SESSION_COOKIE_NAME = "lintel_session";

export function readSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE_NAME] || undefined;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: reply.server.secureCookies,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: reply.server.secureCookies,
    path: "/",
  });
}
