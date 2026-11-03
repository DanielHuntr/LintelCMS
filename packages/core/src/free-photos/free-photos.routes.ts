import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { actorOf } from "../events/event-actor.js";
import { parseRequest } from "../http/http-errors.js";
import { FreePhotoNotFoundError } from "./free-photos.errors.js";
import {
  addFreePhotoRequestSchema,
  freePhotoIdParamsSchema,
  searchFreePhotosQuerySchema,
} from "./free-photos.schema.js";
import { addFreePhoto, findFreePhotoThumbnail, searchFreePhotos } from "./free-photos.service.js";

/** Thumbnails don't change; the browser may keep them for a day, but only for this person. */
const THUMBNAIL_CACHE_CONTROL = "private, max-age=86400";

/**
 * Searches go through Lintel rather than from the browser, so the admin never talks to
 * another service (its Content-Security-Policy wouldn't let it anyway) and visitors' and
 * editors' addresses aren't shared. Thirty a minute per person is plenty for typing.
 */
const SEARCHES_PER_MINUTE = 30;

/**
 * HTTP only. Every route needs `media:upload`: searching is only useful to someone who may
 * add what they find.
 *
 *   GET  /free-photos/search?q=&page=   -> { photos, page, pageCount }
 *   GET  /free-photos/:id/thumbnail     -> the small picture, through Lintel
 *   POST /free-photos/add               { id, folder? } -> 201 Asset (200 if already added)
 */
export async function freePhotosRoutes(server: FastifyInstance) {
  const canUpload = { preHandler: requirePermission("media:upload") };

  server.get(
    "/free-photos/search",
    {
      ...canUpload,
      config: { rateLimit: { max: SEARCHES_PER_MINUTE, timeWindow: "1 minute" } },
    },
    async (request) =>
      searchFreePhotos(
        server.freePhotos.context(),
        parseRequest(searchFreePhotosQuerySchema, request.query),
      ),
  );

  server.get("/free-photos/:id/thumbnail", canUpload, async (request, reply) => {
    const parsed = freePhotoIdParamsSchema.safeParse(request.params);
    if (!parsed.success) throw new FreePhotoNotFoundError();
    const thumbnail = await findFreePhotoThumbnail(server.freePhotos.context(), parsed.data.id);
    return reply
      .type(thumbnail.contentType)
      .header("cache-control", THUMBNAIL_CACHE_CONTROL)
      .header("x-content-type-options", "nosniff")
      .send(thumbnail.body);
  });

  server.post("/free-photos/add", canUpload, async (request, reply) => {
    const body = parseRequest(addFreePhotoRequestSchema, request.body);
    const { asset, created } = await addFreePhoto(
      server.freePhotos.context(),
      body,
      getSignedIn(request).user.id,
    );
    if (created) {
      await announceContentEvent(
        server,
        {
          name: "asset.uploaded",
          asset: {
            id: asset.id,
            filename: asset.filename,
            mimeType: asset.mimeType,
            url: asset.url,
          },
        },
        actorOf(request),
      );
    }
    return reply.code(created ? 201 : 200).send(asset);
  });
}
