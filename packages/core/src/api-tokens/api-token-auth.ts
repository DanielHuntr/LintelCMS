import type { FastifyRequest } from "fastify";
import { isClientSecret } from "../apps/app-credentials.js";
import { authenticateApp } from "../apps/apps.service.js";
import { readBearerToken } from "./api-token-secrets.js";
import { InvalidApiTokenError } from "./api-tokens.errors.js";
import { type AuthenticatedApiToken, authenticateApiToken } from "./api-tokens.service.js";

/**
 * Reads the API token a request carries, once per request. Kept in a WeakMap rather than
 * on the request object, so nothing else in the server has to know tokens exist.
 */
const checkedRequests = new WeakMap<FastifyRequest, Promise<AuthenticatedApiToken | undefined>>();

/**
 * The request's API token, undefined when it sends none, or a 401 when it sends one that
 * isn't valid (a typo should fail loudly, not quietly fall back to public access).
 */
export function findRequestApiToken(
  request: FastifyRequest,
): Promise<AuthenticatedApiToken | undefined> {
  let checked = checkedRequests.get(request);
  if (!checked) {
    checked = checkApiToken(request);
    checkedRequests.set(request, checked);
  }
  return checked;
}

async function checkApiToken(request: FastifyRequest): Promise<AuthenticatedApiToken | undefined> {
  const secret = readBearerToken(request.headers.authorization);
  if (secret === undefined) {
    return undefined;
  }
  // An installed app's client secret works like a token, with the app's approved scopes.
  if (isClientSecret(secret)) {
    const app = await authenticateApp(request.server.database, secret);
    if (!app) {
      throw new InvalidApiTokenError();
    }
    request.log.info(
      { appId: app.app.id, method: request.method, url: request.url },
      "Request from an app",
    );
    return app;
  }
  const token = await authenticateApiToken(request.server.database, secret);
  if (!token) {
    throw new InvalidApiTokenError();
  }
  return token;
}
