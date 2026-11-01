import type { FastifyReply, FastifyRequest } from "fastify";
import { findRequestApiToken } from "../api-tokens/api-token-auth.js";
import { ApiTokenRequiredError } from "../api-tokens/api-tokens.errors.js";
import { requireSignedIn } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { readSetting } from "../settings/settings.service.js";

/**
 * Guard for the public content APIs (/delivery and /graphql). Open to everyone by default;
 * when the "require a token" setting is on, a request needs a valid API token, or an
 * admin session (so editors can still try queries while signed in).
 *
 * A token that is sent but isn't valid is refused either way: findRequestApiToken throws.
 */
export async function requireDeliveryAccess(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (await findRequestApiToken(request)) {
    return;
  }
  if (!(await readSetting(request.server.database, "deliveryRequiresToken"))) {
    return;
  }
  if (readSessionToken(request)) {
    await requireSignedIn(request, reply);
    return;
  }
  throw new ApiTokenRequiredError();
}
