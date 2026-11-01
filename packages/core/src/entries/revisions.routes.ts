import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { RevisionNotFoundError } from "./entries.errors.js";
import { changeContext, readEntryId } from "./entries.routes.js";
import { revisionParamsSchema } from "./entries.schema.js";
import { findRevision, listRevisions, restoreRevision } from "./revisions.service.js";

/**
 * HTTP only:
 *
 *   GET  /entries/:id/revisions                              (entries:read)   newest first
 *   GET  /entries/:id/revisions/:revisionId                  (entries:read)   with its data
 *   POST /entries/:id/revisions/:revisionId/restore          (entries:update) -> Entry
 */
export async function revisionsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("entries:read") };
  const canUpdate = { preHandler: requirePermission("entries:update") };

  server.get("/entries/:id/revisions", canRead, async (request) => {
    const id = readEntryId(request.params);
    return listRevisions(server.database, id);
  });

  server.get("/entries/:id/revisions/:revisionId", canRead, async (request) => {
    const { id, revisionId } = readRevisionParams(request.params);
    return findRevision(server.database, id, revisionId);
  });

  server.post("/entries/:id/revisions/:revisionId/restore", canUpdate, async (request) => {
    const { id, revisionId } = readRevisionParams(request.params);
    return restoreRevision(server.database, id, revisionId, changeContext(request));
  });
}

function readRevisionParams(params: unknown): { id: string; revisionId: string } {
  const parsed = revisionParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RevisionNotFoundError();
  }
  return parsed.data;
}
