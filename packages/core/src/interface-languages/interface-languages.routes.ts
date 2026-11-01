import type { FastifyInstance, FastifyRequest } from "fastify";
import { findSignedIn } from "../auth/auth.service.js";
import { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { parseRequest } from "../http/http-errors.js";
import { chooseInterfaceLanguageRequestSchema } from "./interface-languages.schema.js";
import {
  choosePersonalInterfaceLanguage,
  chooseSiteInterfaceLanguage,
  readInterfaceLanguage,
} from "./interface-languages.service.js";

/**
 * HTTP only:
 *
 *   GET /interface-language               (anyone)           -> { personal, siteDefault, active }
 *   PUT /interface-language               (signed in)        { language | null } -> the same
 *   PUT /interface-language/site-default  (settings:update)  { language | null } -> the same
 *
 * GET works signed out too, so the sign-in screen speaks the site's language.
 */
export async function interfaceLanguagesRoutes(server: FastifyInstance) {
  const deploymentDefault = () => server.defaultInterfaceLanguage;

  server.get("/interface-language", async (request) =>
    readInterfaceLanguage(server.database, await signedInUserId(request), deploymentDefault()),
  );

  server.put("/interface-language", { preHandler: requireSignedIn }, async (request) => {
    const { language } = parseRequest(chooseInterfaceLanguageRequestSchema, request.body);
    const { user } = getSignedIn(request);
    return choosePersonalInterfaceLanguage(server.database, user.id, language, deploymentDefault());
  });

  server.put(
    "/interface-language/site-default",
    { preHandler: requirePermission("settings:update") },
    async (request) => {
      const { language } = parseRequest(chooseInterfaceLanguageRequestSchema, request.body);
      const { user } = getSignedIn(request);
      return chooseSiteInterfaceLanguage(server.database, user.id, language, deploymentDefault());
    },
  );
}

async function signedInUserId(request: FastifyRequest): Promise<string | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  try {
    const found = await findSignedIn(request.server.database, token);
    return found?.signedIn.user.id ?? null;
  } catch {
    // Before setup has a database there are no sessions to find.
    return null;
  }
}
