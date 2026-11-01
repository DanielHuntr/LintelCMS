import type { FastifyReply, FastifyRequest } from "fastify";
import { signOut } from "./auth.service.js";
import { readSessionToken, setSessionCookie } from "./session-cookie.js";

/**
 * Gives the browser a newly started session. Any session it already had (perhaps someone
 * else's, left on a shared computer, or one planted by an attacker) is ended rather than
 * carried on. Every way of signing in ends here: password, two-factor code, passkey and
 * accepting an invitation.
 */
export async function replaceBrowserSession(
  request: FastifyRequest,
  reply: FastifyReply,
  session: { token: string; expiresAt: Date },
): Promise<void> {
  const previousToken = readSessionToken(request);
  if (previousToken && previousToken !== session.token) {
    await signOut(request.server.database, previousToken);
  }
  setSessionCookie(reply, session.token, session.expiresAt);
}
