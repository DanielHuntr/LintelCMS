import {
  type Asset,
  detectFileType,
  type MediaContext,
  setAssetCredit,
  uploadAsset,
} from "../media/index.js";
import { FreePhotoDownloadError, FreePhotoLicenceNotAllowedError } from "./free-photos.errors.js";
import {
  type AddFreePhotoRequest,
  type AllowedLicence,
  allowedLicences,
  type FreePhoto,
  type FreePhotoSearch,
  MAX_SEARCH_PAGE,
  type SearchFreePhotosQuery,
} from "./free-photos.schema.js";
import type { OpenverseClient, OpenverseImage, OpenverseThumbnail } from "./openverse-client.js";
import { downloadPhoto, type PhotoDownloadOptions } from "./photo-download.js";

/** Everything the free photos rules need, gathered per request by the routes. */
export interface FreePhotosContext {
  openverse: OpenverseClient;
  media: MediaContext;
  download: PhotoDownloadOptions;
}

/**
 * Searches Openverse for photos people may use on a business website without asking.
 * Every result's licence is checked here as well as asked for in the search, so a photo
 * with any other licence never reaches the admin.
 */
export async function searchFreePhotos(
  context: FreePhotosContext,
  query: SearchFreePhotosQuery,
): Promise<FreePhotoSearch> {
  const found = await context.openverse.searchImages(query.q, query.page);
  const photos = found.images.flatMap((image) => {
    const photo = describeFreePhoto(image, context.media.publicApiUrl);
    return photo ? [photo] : [];
  });
  return { photos, page: query.page, pageCount: Math.min(found.pageCount, MAX_SEARCH_PAGE) };
}

export function findFreePhotoThumbnail(
  context: FreePhotosContext,
  photoId: string,
): Promise<OpenverseThumbnail> {
  return context.openverse.findThumbnail(photoId);
}

/**
 * Downloads the photo on the server and stores it as an ordinary media item, with its
 * credit (title, creator, licence and where it came from) in the item's `credit`. The
 * photo is looked up by id rather than taken from the request, so only a real Openverse
 * result with an allowed licence can be fetched.
 */
export async function addFreePhoto(
  context: FreePhotosContext,
  request: AddFreePhotoRequest,
  uploadedBy: string,
): Promise<{ asset: Asset; created: boolean }> {
  const image = await context.openverse.findImage(request.id);
  const photo = describeFreePhoto(image, context.media.publicApiUrl);
  if (!photo) throw new FreePhotoLicenceNotAllowedError();

  const contents = await downloadPhoto(image.url, context.download);
  const filename = freePhotoFilename(photo.title);
  // Photos only: a document or drawing (SVG) that calls itself a photo isn't taken.
  const fileType = await detectFileType(contents, filename).catch(() => undefined);
  if (fileType?.kind !== "image" || fileType.mimeType === "image/svg+xml") {
    throw new FreePhotoDownloadError("it isn't a photo Lintel can use");
  }

  const uploaded = await uploadAsset(
    context.media,
    { filename, contents },
    uploadedBy,
    request.folder ?? null,
  );
  // The same photo added again keeps any credit someone has since written by hand.
  if (uploaded.asset.credit !== "") return uploaded;
  const asset = await setAssetCredit(context.media, uploaded.asset.id, describeCredit(photo), {
    licence: photo.licence,
    licenceName: photo.licenceName,
    licenceUrl: photo.licenceUrl,
    creator: photo.creator,
    sourceUrl: photo.pageUrl || null,
  });
  return { asset, created: uploaded.created };
}

/** A result as the admin shows it, or undefined when its licence isn't one that's offered. */
export function describeFreePhoto(
  image: OpenverseImage,
  publicApiUrl: string,
): FreePhoto | undefined {
  const licence = allowedLicence(image.license);
  if (!licence || image.mature) return undefined;
  return {
    id: image.id,
    title: (image.title ?? "").trim(),
    creator: (image.creator ?? "").trim(),
    creatorUrl: webAddressOrNull(image.creator_url),
    licence,
    licenceName: licenceName(licence, image.license_version ?? null),
    licenceUrl: webAddressOrNull(image.license_url),
    pageUrl: webAddressOrNull(image.foreign_landing_url) ?? "",
    source: image.source ?? image.provider ?? "",
    width: image.width ?? null,
    height: image.height ?? null,
    thumbnailUrl: `${publicApiUrl.replace(/\/+$/, "")}/free-photos/${image.id}/thumbnail`,
  };
}

/**
 * The credit as the licences ask for it: title, creator, licence (with its link) and where
 * the photo was found. Plain text, ready to print under the photo or on a credits page.
 */
export function describeCredit(
  photo: Pick<FreePhoto, "title" | "creator" | "licenceName" | "licenceUrl" | "pageUrl">,
): string {
  const title = photo.title ? `“${photo.title}”` : "Photo";
  const creator = photo.creator ? ` by ${photo.creator}` : "";
  const licence = photo.licenceUrl
    ? `${photo.licenceName} (${photo.licenceUrl})`
    : photo.licenceName;
  const source = photo.pageUrl ? ` Source: ${photo.pageUrl}` : "";
  return `${title}${creator}, ${licence}.${source}`;
}

/**
 * A short filename from the photo's title. Titles can be long sentences full of hashtags and
 * slashes ("Bread Truck, 5/2016, pics by..."), and a slash would cut the name short. The
 * media library gives it the extension of what the file really is.
 */
export function freePhotoFilename(title: string): string {
  const MAX_LENGTH = 60;
  const cleaned = title
    .replace(/[\\/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Free photo.jpg";
  if (cleaned.length <= MAX_LENGTH) return `${cleaned}.jpg`;
  const cut = cleaned.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, "")}.jpg`;
}

function allowedLicence(licence: string): AllowedLicence | undefined {
  const lower = licence.toLowerCase();
  return allowedLicences.find((allowed) => allowed === lower);
}

function licenceName(licence: AllowedLicence, version: string | null): string {
  const withVersion = (name: string) => (version ? `${name} ${version}` : name);
  switch (licence) {
    case "cc0":
      return withVersion("CC0");
    case "pdm":
      return "Public Domain Mark";
    case "by":
      return withVersion("CC BY");
    case "by-sa":
      return withVersion("CC BY-SA");
  }
}

/** Only http and https links are passed on to the admin, which shows them as links. */
function webAddressOrNull(address: string | null | undefined): string | null {
  if (!address) return null;
  try {
    const url = new URL(address);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
