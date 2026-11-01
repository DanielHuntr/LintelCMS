import type { Readable } from "node:stream";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { assetVersion } from "./asset-response.js";
import { contentDisposition } from "./content-disposition.js";
import { isImageMimeType } from "./file-types.js";
import {
  type ImageTransform,
  renderTransform,
  transformCacheKey,
  transformMimeType,
  wantsTransform,
} from "./image-transforms.js";
import { loadImageLibrary } from "./image-library.js";
import { AssetNotFoundError } from "./media.errors.js";
import { findAssetById } from "./media.repository.js";
import type { FileTransformQuery } from "./media.schema.js";
import type { MediaContext } from "./media.service.js";
import { readCachedTransform, writeCachedTransform } from "./transform-cache.js";

/**
 * Serving `GET /media/:id/file`: the original, or a resized image made once and then read
 * from the disk cache. Everything needed for the response headers is known before any bytes
 * are read, so a browser that already has the file gets its 304 without touching storage.
 */
export interface AssetFile {
  etag: string;
  mimeType: string;
  filename: string;
  /** Images show in the browser; documents download. */
  disposition: "inline" | "attachment";
  /** True when the request named the asset's current version, so the URL can never change meaning. */
  isCurrentVersion: boolean;
  read(): Promise<{ body: Buffer | Readable; size: number; cache: "hit" | "miss" | "none" }>;
  /**
   * A short-lived link straight to the original in storage. Only there for originals, and
   * only when the storage driver can make one (S3); resized images always come from Lintel.
   */
  signedUrl?: (expiresInSeconds: number) => Promise<string>;
}

export async function findAssetFile(
  media: MediaContext,
  assetId: string,
  query: FileTransformQuery,
): Promise<AssetFile> {
  const asset = await findAssetById(media.database, DEFAULT_TENANT_ID, assetId);
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const isImage = isImageMimeType(asset.mimeType);
  const shared = {
    filename: asset.filename,
    disposition: isImage ? ("inline" as const) : ("attachment" as const),
    isCurrentVersion: query.v === assetVersion(asset),
  };

  // Documents have nothing to resize, so a width or format on one is ignored rather than refused.
  // Without sharp (see image-library.ts) every image is sent as it was uploaded.
  const canResize = isImage && wantsTransform(query) && (await loadImageLibrary()).available;
  if (!canResize) {
    const { storage } = media;
    const makeSignedUrl = storage.signedUrl?.bind(storage);
    return {
      ...shared,
      etag: `"${asset.contentHash.slice(0, 32)}"`,
      mimeType: asset.mimeType,
      read: async () => ({
        body: await storage.get(asset.storageKey),
        size: asset.size,
        cache: "none",
      }),
      ...(makeSignedUrl
        ? {
            signedUrl: (expiresInSeconds: number) =>
              makeSignedUrl(asset.storageKey, {
                expiresInSeconds,
                contentType: asset.mimeType,
                contentDisposition: contentDisposition(shared.disposition, shared.filename),
              }),
          }
        : {}),
    };
  }

  const transform: ImageTransform = {
    w: query.w,
    h: query.h,
    fit: query.fit,
    format: query.format,
  };
  const cacheKey = transformCacheKey(asset, transform);

  return {
    ...shared,
    etag: `"${cacheKey}"`,
    mimeType: transformMimeType(asset, transform),
    read: async () => {
      const cached = await readCachedTransform(media.cacheFolder, asset.id, cacheKey);
      if (cached) {
        return { body: cached, size: cached.length, cache: "hit" };
      }

      const originalStream = await media.storage.get(asset.storageKey);
      const original = Buffer.concat(await originalStream.toArray());
      const rendered = await renderTransform(original, asset, transform);
      await writeCachedTransform(media.cacheFolder, asset.id, cacheKey, rendered);
      return { body: rendered, size: rendered.length, cache: "miss" };
    },
  };
}
