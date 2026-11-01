import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { ApiTokenNotFoundError } from "./api-tokens.errors.js";
import { apiTokenIdParamsSchema, createApiTokenRequestSchema } from "./api-tokens.schema.js";
import { createApiToken, deleteApiToken, listApiTokens } from "./api-tokens.service.js";

/**
 * HTTP only:
 *
 *   GET    /api-tokens      (settings:read)    -> { tokens: [ApiToken] }
 *   POST   /api-tokens      (settings:update)  { name, access } -> 201 { token, secret }
 *   DELETE /api-tokens/:id  (settings:update)  -> 204
 */
export async function apiTokensRoutes(server: FastifyInstance) {
  server.get("/api-tokens", { preHandler: requirePermission("settings:read") }, async () =>
    listApiTokens(server.database),
  );

  server.post(
    "/api-tokens",
    { preHandler: requirePermission("settings:update") },
    async (request, reply) => {
      const tokenRequest = parseRequest(createApiTokenRequestSchema, request.body);
      const { user } = getSignedIn(request);
      const created = await createApiToken(server.database, tokenRequest, user);
      await recordSecurityEvent(server.database, {
        kind: "api-token-created",
        actor: { id: user.id, email: user.email },
        origin: requestOrigin(request),
        details: { token: created.token.name, access: created.token.access },
      });
      // The secret is in this response only; make sure nothing in between keeps a copy.
      return reply.code(201).header("cache-control", "no-store").send(created);
    },
  );

  server.delete(
    "/api-tokens/:id",
    { preHandler: requirePermission("settings:update") },
    async (request, reply) => {
      const parsed = apiTokenIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        throw new ApiTokenNotFoundError();
      }
      const deleted = await deleteApiToken(server.database, parsed.data.id);
      const { user } = getSignedIn(request);
      await recordSecurityEvent(server.database, {
        kind: "api-token-deleted",
        actor: { id: user.id, email: user.email },
        origin: requestOrigin(request),
        details: { token: deleted.name },
      });
      return reply.code(204).send();
    },
  );
}
