import type { FastifyReply, FastifyRequest } from "fastify";
import { findRequestApiToken } from "../api-tokens/api-token-auth.js";
import { hasPermission, type Permission } from "../roles/permissions.js";
import { TwoFactorSetupRequiredError } from "../two-factor/two-factor.errors.js";
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
 *
 * Someone whose role requires two-factor authentication, and who hasn't turned it on, gets
 * 403 TWO_FACTOR_SETUP_REQUIRED from every `requirePermission` route. Routes behind only
 * `requireSignedIn` (their own account) still work, so they can turn it on.
 */

export async function requireSignedIn(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await loadSignedIn(request, reply);
}

/**
 * For a person's own account (password, two-factor, passkeys, sessions): signed in with a
 * browser session. An API token can't change the account of the admin who made it.
 */
export async function requireAccountSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!readSessionToken(request)) {
    throw new NotSignedInError();
  }
  await loadSignedIn(request, reply);
}

/**
 * For decisions a person makes themselves, such as answering an approval: a browser session
 * (a website's API token mustn't approve anything) with two-factor set up if their role
 * requires it, as every `requirePermission` route asks.
 */
export async function requirePersonInBrowser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAccountSession(request, reply);
  if (getSignedIn(request).mustSetUpTwoFactor) {
    throw new TwoFactorSetupRequiredError();
  }
}

export function requirePermission(permission: Permission) {
  return async function checkPermission(request: FastifyRequest, reply: FastifyReply) {
    const signedIn = await loadSignedIn(request, reply);
    if (signedIn.mustSetUpTwoFactor) {
      throw new TwoFactorSetupRequiredError();
    }
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
