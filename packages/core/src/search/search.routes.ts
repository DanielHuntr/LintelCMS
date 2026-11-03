import type { FastifyInstance } from "fastify";
import { getSignedIn, requireSignedIn } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { searchQuerySchema } from "./search.schema.js";
import { search } from "./search.service.js";

/**
 * HTTP only:
 *
 *   GET /search  (signed in)  ?q=&limit= -> { query, entries, assets }
 *
 * Any signed-in person may search; what they find depends on their permissions (see
 * search.service.ts), so the route itself only needs a session.
 */
export async function searchRoutes(server: FastifyInstance) {
  server.get("/search", { preHandler: requireSignedIn }, async (request) => {
    const query = parseRequest(searchQuerySchema, request.query);
    const signedIn = getSignedIn(request);
    return search(server.database, query, {
      permissions: signedIn.permissions,
      siteIds: signedIn.siteIds ?? null,
      publicApiUrl: server.publicApiUrl,
    });
  });
}
