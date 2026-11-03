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

export type AssetKind = "image" | "document";

export interface AssetListQuery {
  search: string;
  /** Undefined shows everything. */
  type: AssetKind | undefined;
  page: number;
  perPage: number;
  /** "shared" or a site's handle for one folder; undefined for every file. */
  folder?: string;
}

export interface AssetChanges {
  alt?: string;
  credit?: string;
  focalPoint?: FocalPoint;
  filename?: string;
}

/** Where an asset is used, from the API's 409 when deleting it. */
export interface AssetUsage {
  entryId: string;
  title: string;
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
  return apiRequest<{ assets: Asset[]; total: number }>(`/media?${parameters}`);
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
export function deleteAsset(assetId: string) {
  return apiRequest<void>(`/media/${encodeURIComponent(assetId)}`, { method: "DELETE" });
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
