import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { requireEntrySiteAccess } from "../sites/request-site.js";
import { RevisionNotFoundError } from "./entries.errors.js";
import { requireEntryPermission } from "./entry-access.js";
import { changeContext, readEntryId } from "./entries.routes.js";
import { keepVersionRequestSchema, revisionParamsSchema } from "./entries.schema.js";
import { findRevision, keepVersion, listRevisions, restoreRevision } from "./revisions.service.js";

/**
 * HTTP only:
 *
 *   GET  /entries/:id/revisions                              (entries:read)   newest first
 *   GET  /entries/:id/revisions/:revisionId                  (entries:read)   with its data
 *   POST /entries/:id/revisions/:revisionId/restore          (entries:update) -> Entry
 *   POST /entries/:id/revisions/keep                         (entries:update) { data } -> 204
 */
export async function revisionsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: [requirePermission("entries:read"), requireEntrySiteAccess] };
  // Restoring is a change to the entry, so an Author may restore their own.
  const canUpdate = { preHandler: [requireEntryPermission("update"), requireEntrySiteAccess] };

  server.get("/entries/:id/revisions", canRead, async (request) => {
    const id = readEntryId(request.params);
    return listRevisions(server.database, id);
  });

  server.get("/entries/:id/revisions/:revisionId", canRead, async (request) => {
    const { id, revisionId } = readRevisionParams(request.params);
    return findRevision(server.database, id, revisionId);
  });

  server.post("/entries/:id/revisions/keep", canUpdate, async (request, reply) => {
    const { data } = parseRequest(keepVersionRequestSchema, request.body);
    const id = readEntryId(request.params);
    await keepVersion(server.database, id, data, getSignedIn(request).user.id);
    return reply.code(204).send();
  });

  server.post("/entries/:id/revisions/:revisionId/restore", canUpdate, async (request) => {
    const { id, revisionId } = readRevisionParams(request.params);
    await server.collaboration.storeOpenDesigns(id);
    const restored = await restoreRevision(server.database, id, revisionId, changeContext(request));
    server.collaboration.entryChanged(id, {
      version: restored.version,
      personId: getSignedIn(request).user.id,
      what: "saved",
      fields: Object.keys(restored.data),
    });
    return restored;
  });
}

function readRevisionParams(params: unknown): { id: string; revisionId: string } {
  const parsed = revisionParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RevisionNotFoundError();
  }
  return parsed.data;
}
