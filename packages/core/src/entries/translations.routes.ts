import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { requireEntrySiteAccess } from "../sites/request-site.js";
import { parseRequest } from "../http/http-errors.js";
import { readEntryId } from "./entries.routes.js";
import { translateEntryRequestSchema } from "./entries.schema.js";
import { translateEntry } from "./entry-translations.service.js";

/**
 * HTTP only:
 *
 *   POST /entries/:id/translations  (entries:create)  { locale, withParents? }
 *        -> 201 Entry (the new draft), 409 TRANSLATION_EXISTS, or 409 PARENTS_NOT_TRANSLATED
 *           with `missingParents` unless `withParents` starts those too
 *
 * The translations themselves are listed on every entry, as `translations`.
 */
export async function translationsRoutes(server: FastifyInstance) {
  server.post(
    "/entries/:id/translations",
    { preHandler: [requirePermission("entries:create"), requireEntrySiteAccess] },
    async (request, reply) => {
      const id = readEntryId(request.params);
      const body = parseRequest(translateEntryRequestSchema, request.body);
      const translation = await translateEntry(server.database, id, body, {
        authorId: getSignedIn(request).user.id,
      });
      return reply.code(201).send(translation);
    },
  );
}
