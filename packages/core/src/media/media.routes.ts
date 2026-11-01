import multipart from "@fastify/multipart";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import type { AssetUsageFinder } from "./asset-lookup.js";
import { contentDisposition } from "./content-disposition.js";
import { findAssetFile } from "./media-file.service.js";
import {
  AssetInUseError,
  AssetNotFoundError,
  FileTooLargeError,
  MAX_UPLOAD_MEGABYTES,
  NoFileUploadedError,
} from "./media.errors.js";
import {
  assetIdParamsSchema,
  fileTransformQuerySchema,
  listAssetsQuerySchema,
  updateAssetRequestSchema,
} from "./media.schema.js";
import {
  deleteAsset,
  getAsset,
  listAssets,
  type MediaContext,
  updateAsset,
  uploadAsset,
} from "./media.service.js";
import type { StorageDriver } from "./storage-driver.js";

export interface MediaRoutesOptions {
  storage: StorageDriver;
  cacheFolder: string;
  usageFinder: AssetUsageFinder;
}

const MAX_UPLOAD_BYTES = MAX_UPLOAD_MEGABYTES * 1024 * 1024;
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const ONE_HOUR_IN_SECONDS = 60 * 60;

/**
 * Files people view or download are sandboxed: even an SVG that slipped past the upload
 * checks can't run a script, load anything or submit a form from the API's address.
 */
const FILE_SECURITY_POLICY =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

/**
 * HTTP only:
 *
 *   POST   /media           (media:upload)  multipart "file" -> 201 Asset (200 if already uploaded)
 *   GET    /media           (media:read)    ?search=&type=image|document&page=&perPage=
 *   GET    /media/:id       (media:read)    -> Asset
 *   PATCH  /media/:id       (media:update)  { alt?, focalPoint?, filename? } -> Asset
 *   DELETE /media/:id       (media:delete)  -> 204, or 409 ASSET_IN_USE with usedBy
 *   GET    /media/:id/file  (public)        ?w=&h=&fit=cover|contain&format=webp|avif|jpeg|png
 */
export async function mediaRoutes(server: FastifyInstance, options: MediaRoutesOptions) {
  // Registered here rather than on the whole server, so only uploads accept multipart bodies.
  await server.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
  });

  const context = (): MediaContext => ({
    database: server.database,
    storage: options.storage,
    cacheFolder: options.cacheFolder,
    publicApiUrl: server.publicApiUrl,
    usageFinder: options.usageFinder,
  });

  server.post(
    "/media",
    { preHandler: requirePermission("media:upload") },
    async (request, reply) => {
      const file = await readUploadedFile(request);
      const { asset, created } = await uploadAsset(context(), file, getSignedIn(request).user.id);
      return reply.code(created ? 201 : 200).send(asset);
    },
  );

  server.get("/media", { preHandler: requirePermission("media:read") }, async (request) =>
    listAssets(context(), parseRequest(listAssetsQuerySchema, request.query)),
  );

  server.get("/media/:id", { preHandler: requirePermission("media:read") }, async (request) =>
    getAsset(context(), parseAssetId(request.params)),
  );

  server.patch("/media/:id", { preHandler: requirePermission("media:update") }, async (request) => {
    const changes = parseRequest(updateAssetRequestSchema, request.body ?? {});
    return updateAsset(context(), parseAssetId(request.params), changes);
  });

  server.delete(
    "/media/:id",
    { preHandler: requirePermission("media:delete") },
    async (request, reply) => {
      try {
        await deleteAsset(context(), parseAssetId(request.params));
      } catch (error) {
        if (error instanceof AssetInUseError) {
          return sendAssetInUse(reply, error);
        }
        throw error;
      }
      return reply.code(204).send();
    },
  );

  // Public on purpose: these URLs go into the website's <img> tags. See the README.
  server.get("/media/:id/file", async (request, reply) => {
    const query = parseRequest(fileTransformQuerySchema, request.query);
    const file = await findAssetFile(context(), parseAssetId(request.params), query);

    reply
      .header("etag", file.etag)
      .header(
        "cache-control",
        file.isCurrentVersion
          ? `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`
          : `public, max-age=${ONE_HOUR_IN_SECONDS}`,
      )
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", FILE_SECURITY_POLICY)
      // Websites on other addresses show these images, so browsers must be allowed to load them.
      .header("cross-origin-resource-policy", "cross-origin");

    if (request.headers["if-none-match"] === file.etag) {
      return reply.code(304).send();
    }

    const { body, size, cache } = await file.read();
    if (cache !== "none") {
      reply.header("lintel-transform-cache", cache);
    }
    return reply
      .type(file.mimeType)
      .header("content-length", size)
      .header("content-disposition", contentDisposition(file.disposition, file.filename))
      .send(body);
  });
}

/** Turns multipart's own errors into ones an editor can act on. */
async function readUploadedFile(request: FastifyRequest) {
  if (!request.isMultipart()) {
    throw new NoFileUploadedError();
  }
  const part = await request.file();
  if (!part || part.fieldname !== "file") {
    throw new NoFileUploadedError();
  }

  try {
    return { filename: part.filename, contents: await part.toBuffer() };
  } catch (error) {
    if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
      throw new FileTooLargeError();
    }
    throw error;
  }
}

/** A malformed id can't match any asset, so it's a 404 like any other missing one. */
function parseAssetId(params: unknown): string {
  const parsed = assetIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new AssetNotFoundError();
  }
  return parsed.data.id;
}

function sendAssetInUse(reply: FastifyReply, error: AssetInUseError) {
  return reply.code(error.statusCode).send({
    statusCode: error.statusCode,
    code: error.code,
    error: "Conflict",
    message: error.message,
    usedBy: error.usedBy,
  });
}
