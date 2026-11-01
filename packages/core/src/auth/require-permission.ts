import type { FastifyReply, FastifyRequest } from "fastify";
import { findRequestApiToken } from "../api-tokens/api-token-auth.js";
import { hasPermission, type Permission } from "../roles/permissions.js";
import { NotSignedInError, PermissionDeniedError } from "./auth.errors.js";
import type { SignedIn } from "./auth.schema.js";
import { findSignedIn } from "./auth.service.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./session-cookie.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * The signed-in user and everything they may do. Set by `requireSignedIn` and
     * `requirePermission`; null on routes that use neither. Read it with `getSignedIn`.
     */
    signedIn: SignedIn | null;
  }
}

/**
 * Guards for routes. Use them as a preHandler:
 *
 *   server.post("/entries/:id/publish", { preHandler: requirePermission("entries:publish") }, ...)
 *
 * Signed out gives 401 and not allowed gives 403, each with a message an editor can follow.
 * Without a session cookie, an API token (`Authorization: Bearer ...`) is accepted instead;
 * it acts for the admin who made it, with the token's narrower permissions (see src/api-tokens).
 */

export async function requireSignedIn(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await loadSignedIn(request, reply);
}

export function requirePermission(permission: Permission) {
  return async function checkPermission(request: FastifyRequest, reply: FastifyReply) {
    const signedIn = await loadSignedIn(request, reply);
    if (!hasPermission(signedIn.permissions, permission)) {
      throw new PermissionDeniedError(permission);
    }
  };
}

/** For handlers behind a guard: the signed-in user, without a null check at every use. */
export function getSignedIn(request: FastifyRequest): SignedIn {
  if (!request.signedIn) {
    throw new NotSignedInError();
  }
  return request.signedIn;
}

async function loadSignedIn(request: FastifyRequest, reply: FastifyReply): Promise<SignedIn> {
  if (request.signedIn) {
    return request.signedIn;
  }

  const token = readSessionToken(request);
  if (!token) {
    const apiToken = await findRequestApiToken(request);
    if (!apiToken) {
      throw new NotSignedInError();
    }
    request.signedIn = apiToken.signedIn;
    return apiToken.signedIn;
  }

  const found = await findSignedIn(request.server.database, token);
  if (!found) {
    // The cookie points at a session that has ended; remove it so the browser stops sending it.
    clearSessionCookie(reply);
    throw new NotSignedInError();
  }

  if (found.sessionWasExtended) {
    setSessionCookie(reply, token, found.sessionExpiresAt);
  }

  request.signedIn = found.signedIn;
  return found.signedIn;
}
