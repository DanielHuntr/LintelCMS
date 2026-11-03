import { apiRequest, apiUrl } from "../api/client.js";
import { siteHeaders } from "../sites/currentSite.js";
import type { Asset } from "../media/media.api.js";

/** One free photo, as the API describes it (see packages/core/src/free-photos). */
export interface FreePhoto {
  id: string;
  title: string;
  creator: string;
  creatorUrl: string | null;
  licence: "cc0" | "pdm" | "by" | "by-sa";
  /** "CC BY 4.0", "CC0 1.0", "Public Domain Mark". */
  licenceName: string;
  licenceUrl: string | null;
  /** Where the photo was found, such as its Flickr page. */
  pageUrl: string;
  source: string;
  width: number | null;
  height: number | null;
  /** On Lintel's API, and only for signed-in people: load it with `loadThumbnail`. */
  thumbnailUrl: string;
}

export interface FreePhotoSearch {
  photos: FreePhoto[];
  page: number;
  pageCount: number;
}

export function searchFreePhotos(searchText: string, page: number) {
  const query = new URLSearchParams({ q: searchText, page: String(page) });
  return apiRequest<FreePhotoSearch>(`/free-photos/search?${query}`);
}

/** Downloads the photo into the media library, with its credit. Resolves with the new file. */
export function addFreePhoto(photoId: string, folder?: string) {
  return apiRequest<Asset>("/free-photos/add", {
    method: "POST",
    body: folder ? { id: photoId, folder } : { id: photoId },
  });
}

/**
 * Thumbnails need the session cookie, which an <img> on another address may not send, so
 * they're fetched like any API call and shown from a blob: URL.
 */
export async function loadThumbnail(photoId: string): Promise<Blob> {
  const response = await fetch(`${apiUrl}/free-photos/${encodeURIComponent(photoId)}/thumbnail`, {
    credentials: "include",
    headers: siteHeaders(),
  });
  if (!response.ok) throw new Error(`The thumbnail answered ${response.status}`);
  return response.blob();
}
