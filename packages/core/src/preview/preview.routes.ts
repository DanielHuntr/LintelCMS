import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { readEntryId } from "../entries/entries.routes.js";
import { parseRequest } from "../http/http-errors.js";
import { previewQuerySchema } from "./preview.schema.js";
import { createEntryPreview, findPreviewedEntry } from "./preview.service.js";

/**
 * Drafts must never sit in a shared cache, and preview pages shouldn't be indexed.
 * Also used by the delivery API when it serves a draft.
 */
export const PREVIEW_CACHE_CONTROL = "private, no-store";

/**
 * HTTP only:
 *
 *   POST /entries/:id/preview  (entries:read)       -> { token, expiresAt, previewUrl }
 *   GET  /preview              ?token= (no session) -> { collection, entry: DeliveredEntry }
 *
 * Anyone who can read an entry in the admin can already see its draft, so making a
 * token needs only entries:read. The token itself is the permission to read it elsewhere.
 */
export async function previewRoutes(server: FastifyInstance) {
  server.post(
    "/entries/:id/preview",
    { preHandler: requirePermission("entries:read") },
    async (request) => createEntryPreview(server.database, readEntryId(request.params)),
  );

  server.get("/preview", async (request, reply) => {
    const { token } = parseRequest(previewQuerySchema, request.query);
    const previewed = await findPreviewedEntry(server.database, token, server.assetLookup);
    return reply
      .header("cache-control", PREVIEW_CACHE_CONTROL)
      .header("x-robots-tag", "noindex")
      .send(previewed);
  });
}
