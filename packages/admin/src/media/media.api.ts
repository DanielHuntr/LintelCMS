import type { FocalPoint } from "@lintel/core/media-crop";
import { apiErrorFromBody, apiRequest, apiUrl } from "../api/client.js";
import { siteHeaders } from "../sites/currentSite.js";

/** An uploaded file, as the API describes it (see packages/core/src/media/media.schema.ts). */
export interface Asset {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  /** Who made it and under what licence, such as a free photo's credit. Often empty. */
  credit: string;
  /** The credit as the website shows it under the picture; null when none is shown. */
  photoCredit?: {
    text: string;
    creator: string | null;
    sourceUrl: string | null;
    licenceName: string | null;
    licenceUrl: string | null;
  } | null;
  focalPoint: FocalPoint;
  /** Absolute and public: the original file. */
  url: string;
  /** 400px wide WebP. Null for documents. */
  thumbnailUrl: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
  /** The site whose folder it is in; null for the shared library. */
  siteId?: string | null;
}

export type AssetKind = "image" | "document" | "model";

export interface AssetListQuery {
  search: string;
  /** Undefined shows everything. */
  type: AssetKind | undefined;
  page: number;
  perPage: number;
  /** "shared" or a site's handle for one folder; undefined for every file. */
  folder?: string;
  /** Only pictures with no description yet. */
  missingAlt?: boolean;
}

export interface AssetChanges {
  alt?: string;
  credit?: string;
  focalPoint?: FocalPoint;
  filename?: string;
}

/** Where an asset is used, from the API's 409 when deleting it. */
export interface AssetUsage {
  /** The entry's id, or for a site font the font's. */
  entryId: string;
  /** The entry's title, or the font's family. */
  title: string;
  /** "siteFonts" for a file one of the site's fonts is made of; "siteCursor" for a site's cursor. */
  place?: "siteFonts" | "siteCursor";
}

export function isImage(asset: Pick<Asset, "mimeType">): boolean {
  return asset.mimeType.startsWith("image/");
}

/** A resized version of an image, from the API's transform options. Keeps the URL's version. */
export function assetImageUrl(
  asset: Pick<Asset, "url">,
  options: { width?: number; height?: number; format?: "webp" | "avif" | "jpeg" | "png" },
): string {
  const url = new URL(asset.url);
  if (options.width) url.searchParams.set("w", String(options.width));
  if (options.height) url.searchParams.set("h", String(options.height));
  if (options.format) url.searchParams.set("format", options.format);
  return url.toString();
}

export function listAssets(query: AssetListQuery) {
  const parameters = new URLSearchParams({
    page: String(query.page),
    perPage: String(query.perPage),
  });
  if (query.search.trim()) parameters.set("search", query.search.trim());
  if (query.type) parameters.set("type", query.type);
  if (query.folder) parameters.set("folder", query.folder);
  if (query.missingAlt) parameters.set("missingAlt", "true");
  return apiRequest<{ assets: Asset[]; total: number }>(`/media?${parameters}`);
}

/** Whether the server can resize images (see packages/core/src/media/image-library.ts). */
export interface ImageResizingStatus {
  available: boolean;
  problem: string | null;
}

export function getImageResizingStatus() {
  return apiRequest<ImageResizingStatus>("/media/image-resizing");
}

export function getAsset(assetId: string) {
  return apiRequest<Asset>(`/media/${encodeURIComponent(assetId)}`);
}

export function updateAsset(assetId: string, changes: AssetChanges) {
  return apiRequest<Asset>(`/media/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    body: changes,
  });
}

/** Rejects with an ApiError whose `details.usedBy` lists the entries when the file is in use. */
/** Moves the file to the media recycle bin, from where Undo or the bin can bring it back. */
export function deleteAsset(assetId: string) {
  return apiRequest<void>(`/media/${encodeURIComponent(assetId)}`, { method: "DELETE" });
}

/** A file in the media recycle bin (`GET /media-bin`). */
export interface BinnedAsset {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
}

export function listMediaBin(): Promise<{ items: BinnedAsset[] }> {
  return apiRequest("/media-bin");
}

/** Puts a deleted file back in the library, with the same id, name and alt text. */
export function restoreAsset(assetId: string): Promise<Asset> {
  return apiRequest(`/media-bin/${encodeURIComponent(assetId)}/restore`, { method: "POST" });
}

export function deleteAssetForGood(assetId: string): Promise<void> {
  return apiRequest(`/media-bin/${encodeURIComponent(assetId)}`, { method: "DELETE" });
}

export function emptyMediaBin(): Promise<{ deleted: number }> {
  return apiRequest("/media-bin", { method: "DELETE" });
}

/**
 * Uploads one file, reporting progress from 0 to 1. Uses XMLHttpRequest because fetch
 * can't report upload progress. Network failures reject with a TypeError, as fetch's do.
 */
export function uploadAsset(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
  /** A site's handle to upload into its folder; left out, the shared library. */
  folder?: string,
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    request.open("POST", `${apiUrl}/media${query}`);
    request.withCredentials = true;
    for (const [name, value] of Object.entries(siteHeaders())) {
      request.setRequestHeader(name, value);
    }
    request.responseType = "json";

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve(request.response as Asset);
      } else {
        reject(apiErrorFromBody(request.status, request.statusText, request.response));
      }
    });
    request.addEventListener("error", () => reject(new TypeError("Failed to fetch")));
    request.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled", "AbortError")),
    );
    signal?.addEventListener("abort", () => request.abort());

    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
