import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { actorOf } from "../events/event-actor.js";
import { parseRequest } from "../http/http-errors.js";
import { hasPermission } from "../roles/permissions.js";
import { RecycleBinItemNotFoundError } from "./recycle-bin.errors.js";
import {
  deleteFromRecycleBin,
  emptyRecycleBin,
  listRecycleBin,
  restoreFromRecycleBin,
  type SiteLimit,
} from "./recycle-bin.service.js";

/**
 * HTTP only. Moving an entry to the bin is `POST /content-tree/entries/:id/recycle`.
 *
 *   GET    /recycle-bin                     (entries:read)
 *   POST   /recycle-bin/:itemId/restore     (entries:create)  { asBefore? } -> { entryId, parentId, restoredCount }
 *   DELETE /recycle-bin/:itemId             (entries:delete)  -> 204
 *   DELETE /recycle-bin                     (entries:delete)  -> { deleted }
 *
 * Someone whose roles are limited to some sites only sees, restores and deletes those
 * sites' items; emptying the bin leaves other sites' items alone.
 */
export async function recycleBinRoutes(server: FastifyInstance) {
  server.get("/recycle-bin", { preHandler: requirePermission("entries:read") }, async (request) =>
    listRecycleBin(server.database, siteLimitOf(request)),
  );

  server.post(
    "/recycle-bin/:itemId/restore",
    { preHandler: requirePermission("entries:create") },
    async (request) => {
      const { asBefore } = parseRequest(restoreRequestSchema, request.body ?? {});
      const { liveEntryIds, ...restored } = await restoreFromRecycleBin(
        server.database,
        readItemId(request.params),
        siteLimitOf(request),
        {
          asBefore,
          mayPublish: hasPermission(getSignedIn(request).permissions, "entries:publish"),
        },
      );
      // What Undo put back on the site is announced, so caches and webhooks catch up.
      for (const entryId of liveEntryIds) {
        const entry = await describeEntryForEvent(server.database, entryId);
        await announceContentEvent(server, { name: "entry.published", entry }, actorOf(request));
      }
      return restored;
    },
  );

  server.delete(
    "/recycle-bin/:itemId",
    { preHandler: requirePermission("entries:delete") },
    async (request, reply) => {
      await deleteFromRecycleBin(server.database, readItemId(request.params), siteLimitOf(request));
      return reply.code(204).send();
    },
  );

  server.delete(
    "/recycle-bin",
    { preHandler: requirePermission("entries:delete") },
    async (request) => emptyRecycleBin(server.database, siteLimitOf(request)),
  );
}

function siteLimitOf(request: FastifyRequest): SiteLimit {
  return getSignedIn(request).siteIds ?? null;
}

const itemParamsSchema = z.object({ itemId: z.uuid() });

/** `asBefore` is Undo's: back in its old place, and live again if it was (see the service). */
const restoreRequestSchema = z.object({
  asBefore: z.boolean({ error: "asBefore should be true or false" }).default(false),
});

/** An id that isn't a uuid is simply not in the bin. */
function readItemId(params: unknown): string {
  const parsed = itemParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RecycleBinItemNotFoundError();
  }
  return parseRequest(itemParamsSchema, params).itemId;
}
