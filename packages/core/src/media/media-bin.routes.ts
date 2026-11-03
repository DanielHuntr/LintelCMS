import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requirePermission } from "../auth/require-permission.js";
import {
  deleteBinnedAsset,
  emptyMediaBin,
  listBinnedAssets,
  restoreBinnedAsset,
} from "./media-bin.service.js";
import { BinnedAssetNotFoundError } from "./media.errors.js";
import type { MediaRoutesOptions } from "./media.routes.js";
import type { MediaContext } from "./media.service.js";

/**
 * HTTP only. Files go to the bin with `DELETE /media/:id`.
 *
 *   GET    /media-bin                (media:read)    -> { items: [{ id, filename, mimeType, size, deletedAt, deletedBy }] }
 *   POST   /media-bin/:id/restore    (media:upload)  -> Asset, back in the library
 *   DELETE /media-bin/:id            (media:delete)  -> 204, gone for good
 *   DELETE /media-bin                (media:delete)  -> { deleted }, the bin emptied
 *
 * `:id` is the file's own id, so Undo can restore what it just deleted.
 */
export async function mediaBinRoutes(server: FastifyInstance, options: MediaRoutesOptions) {
  const context = (): MediaContext => ({
    database: server.database,
    storage: options.storage,
    cacheFolder: options.cacheFolder,
    publicApiUrl: server.publicApiUrl,
    usageFinder: options.usageFinder,
  });

  server.get("/media-bin", { preHandler: requirePermission("media:read") }, async () =>
    listBinnedAssets(context()),
  );

  server.post(
    "/media-bin/:id/restore",
    { preHandler: requirePermission("media:upload") },
    async (request) => restoreBinnedAsset(context(), readBinnedId(request.params)),
  );

  server.delete(
    "/media-bin/:id",
    { preHandler: requirePermission("media:delete") },
    async (request, reply) => {
      await deleteBinnedAsset(context(), readBinnedId(request.params));
      return reply.code(204).send();
    },
  );

  server.delete("/media-bin", { preHandler: requirePermission("media:delete") }, async () =>
    emptyMediaBin(context()),
  );
}

const binnedParamsSchema = z.object({ id: z.uuid() });

/** An id that isn't a uuid is simply not in the bin. */
function readBinnedId(params: unknown): string {
  const parsed = binnedParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new BinnedAssetNotFoundError();
  }
  return parsed.data.id;
}
