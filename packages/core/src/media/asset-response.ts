import { createHash } from "node:crypto";
import { isImageMimeType } from "./file-types.js";
import type { AssetRow } from "./media.table.js";
import type { Asset } from "./media.schema.js";
import { photoCreditFor } from "./photo-credit.js";

/** Thumbnails in the admin grid and picker: wide enough for a sharp 200px tile on a retina screen. */
const THUMBNAIL_WIDTH = 400;

/**
 * A short fingerprint of everything that changes how an asset's files look: its bytes and
 * its focal point. It goes into every URL the API hands out (`?v=`), so a URL never shows
 * two different pictures and browsers and CDNs may keep it for a year.
 */
export function assetVersion(asset: Pick<AssetRow, "contentHash" | "focalX" | "focalY">): string {
  return createHash("sha256")
    .update(`${asset.contentHash}:${asset.focalX}:${asset.focalY}`)
    .digest("hex")
    .slice(0, 12);
}

export function assetFileUrl(
  publicApiUrl: string,
  asset: Pick<AssetRow, "id" | "contentHash" | "focalX" | "focalY">,
  transform: Record<string, string | number> = {},
): string {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(transform).map(([key, value]) => [key, String(value)])),
    v: assetVersion(asset),
  });
  return `${publicApiUrl.replace(/\/+$/, "")}/media/${asset.id}/file?${query}`;
}

export function toAssetResponse(
  asset: AssetRow & { uploaderName: string | null },
  publicApiUrl: string,
): Asset {
  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    credit: asset.credit,
    photoCredit: photoCreditFor(asset),
    focalPoint: { x: asset.focalX, y: asset.focalY },
    url: assetFileUrl(publicApiUrl, asset),
    thumbnailUrl: isImageMimeType(asset.mimeType)
      ? assetFileUrl(publicApiUrl, asset, { w: THUMBNAIL_WIDTH, format: "webp" })
      : null,
    createdAt: asset.createdAt.toISOString(),
    uploadedBy:
      asset.uploadedBy && asset.uploaderName
        ? { id: asset.uploadedBy, name: asset.uploaderName }
        : null,
    siteId: asset.siteId,
  };
}
