import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { TooManySignInAttemptsError } from "./auth.errors.js";
import { signInRequestSchema } from "./auth.schema.js";
import { signIn, signOut } from "./auth.service.js";
import { getSignedIn, requireSignedIn } from "./require-permission.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./session-cookie.js";

/**
 * Sign-in limits per IP address. Ten a minute is plenty for a person who mistyped,
 * and far too few for a script guessing passwords.
 */
const SIGN_IN_ATTEMPTS_PER_MINUTE = 10;

/**
 * HTTP only: read the request, call the auth service, set or clear the cookie.
 *
 *   POST /auth/sign-in   { email, password } -> { user, permissions } and the session cookie
 *   POST /auth/sign-out  ends the session (if any) and clears the cookie -> 204
 *   GET  /auth/me        -> { user, permissions }, or 401 when signed out
 */
export async function authRoutes(server: FastifyInstance) {
  server.post(
    "/auth/sign-in",
    {
      config: {
        rateLimit: {
          max: SIGN_IN_ATTEMPTS_PER_MINUTE,
          timeWindow: "1 minute",
          errorResponseBuilder: (_request, context) =>
            new TooManySignInAttemptsError(context.after),
        },
      },
    },
    async (request, reply) => {
      const signInRequest = parseRequest(signInRequestSchema, request.body);
      const { session, signedIn } = await signIn(
        server.database,
        signInRequest,
        request.headers["user-agent"],
      );

      setSessionCookie(reply, session.token, session.expiresAt);
      return signedIn;
    },
  );

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
