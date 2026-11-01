import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { readEntryId } from "./entries.routes.js";
import { translateEntryRequestSchema } from "./entries.schema.js";
import { translateEntry } from "./entry-translations.service.js";

/**
 * HTTP only:
 *
 *   POST /entries/:id/translations  (entries:create)  { locale } -> 201 Entry (the new draft),
 *                                                      or 409 TRANSLATION_EXISTS
 *
 * The translations themselves are listed on every entry, as `translations`.
 */
export async function translationsRoutes(server: FastifyInstance) {
  server.post(
    "/entries/:id/translations",
    { preHandler: requirePermission("entries:create") },
    async (request, reply) => {
      const id = readEntryId(request.params);
      const { locale } = parseRequest(translateEntryRequestSchema, request.body);
      const translation = await translateEntry(
        server.database,
        id,
        { locale },
        {
          authorId: getSignedIn(request).user.id,
        },
      );
      return reply.code(201).send(translation);
    },
  );
}
