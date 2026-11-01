import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { RecycleBinItemNotFoundError } from "./recycle-bin.errors.js";
import {
  deleteFromRecycleBin,
  emptyRecycleBin,
  listRecycleBin,
  restoreFromRecycleBin,
} from "./recycle-bin.service.js";

/**
 * HTTP only. Moving an entry to the bin is `POST /content-tree/entries/:id/recycle`.
 *
 *   GET    /recycle-bin                     (entries:read)
 *   POST   /recycle-bin/:itemId/restore     (entries:create)  -> { entryId, parentId, restoredCount }
 *   DELETE /recycle-bin/:itemId             (entries:delete)  -> 204
 *   DELETE /recycle-bin                     (entries:delete)  -> { deleted }
 */
export async function recycleBinRoutes(server: FastifyInstance) {
  server.get("/recycle-bin", { preHandler: requirePermission("entries:read") }, async () =>
    listRecycleBin(server.database),
  );

  server.post(
    "/recycle-bin/:itemId/restore",
    { preHandler: requirePermission("entries:create") },
    async (request) => restoreFromRecycleBin(server.database, readItemId(request.params)),
  );

  server.delete(
    "/recycle-bin/:itemId",
    { preHandler: requirePermission("entries:delete") },
    async (request, reply) => {
      await deleteFromRecycleBin(server.database, readItemId(request.params));
      return reply.code(204).send();
    },
  );

  server.delete("/recycle-bin", { preHandler: requirePermission("entries:delete") }, async () =>
    emptyRecycleBin(server.database),
  );
}

const itemParamsSchema = z.object({ itemId: z.uuid() });

/** An id that isn't a uuid is simply not in the bin. */
function readItemId(params: unknown): string {
  const parsed = itemParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RecycleBinItemNotFoundError();
  }
  return parseRequest(itemParamsSchema, params).itemId;
}
