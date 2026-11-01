import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { requestOrigin } from "../security-log/security-log.service.js";
import { TooManySignInAttemptsError } from "./auth.errors.js";
import { signInRequestSchema, twoFactorSignInRequestSchema } from "./auth.schema.js";
import { completeTwoFactorSignIn, signIn, signOut } from "./auth.service.js";
import { getSignedIn, requireSignedIn } from "./require-permission.js";
import { replaceBrowserSession } from "./browser-session.js";
import { clearSessionCookie, readSessionToken } from "./session-cookie.js";

/**
 * Sign-in limits per IP address. Ten a minute is plenty for a person who mistyped,
 * and far too few for a script guessing passwords.
 */
const SIGN_IN_ATTEMPTS_PER_MINUTE = 10;

export const signInRateLimit = {
  rateLimit: {
    max: SIGN_IN_ATTEMPTS_PER_MINUTE,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request: unknown, context: { after: string }) =>
      new TooManySignInAttemptsError(context.after),
  },
};

/**
 * HTTP only: read the request, call the auth service, set or clear the cookie.
 *
 *   POST /auth/sign-in             { email, password } -> { user, permissions } and the session cookie,
 *                                  or { twoFactorRequired: true, challengeToken } (no cookie yet)
 *   POST /auth/sign-in/two-factor  { challengeToken, code | recoveryCode } -> { user, permissions } and the cookie
 *   POST /auth/sign-out            ends the session (if any) and clears the cookie -> 204
 *   GET  /auth/me                  -> { user, permissions }, or 401 when signed out
 *
 * Passkey sign-in is in src/passkeys; forgotten passwords are in src/password-reset.
 */
export async function authRoutes(server: FastifyInstance) {
  server.post("/auth/sign-in", { config: signInRateLimit }, async (request, reply) => {
    const signInRequest = parseRequest(signInRequestSchema, request.body);
    const outcome = await signIn(server.database, signInRequest, requestOrigin(request));

    if (outcome.kind === "two-factor-required") {
      return reply.header("cache-control", "no-store").send({
        twoFactorRequired: outcome.twoFactorRequired,
        challengeToken: outcome.challengeToken,
      });
    }
    await replaceBrowserSession(request, reply, outcome.session);
    return outcome.signedIn;
  });

  server.post("/auth/sign-in/two-factor", { config: signInRateLimit }, async (request, reply) => {
    const twoFactorRequest = parseRequest(twoFactorSignInRequestSchema, request.body);
    const { session, signedIn } = await completeTwoFactorSignIn(
      server.database,
      twoFactorRequest,
      requestOrigin(request),
    );
    await replaceBrowserSession(request, reply, session);
    return signedIn;
  });

  server.post("/auth/sign-out", async (request, reply) => {
    const token = readSessionToken(request);
    if (token) {
      await signOut(server.database, token);
    }

    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  server.get("/auth/me", { preHandler: requireSignedIn }, async (request) => getSignedIn(request));
}
