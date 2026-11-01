import { createHash, randomUUID } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findErrorCode } from "../database/database-errors.js";
import type { AssetUsageFinder } from "./asset-lookup.js";
import { toAssetResponse } from "./asset-response.js";
import { decodeAsText, detectFileType, findAllowedFileType } from "./file-types.js";
import { sanitiseFilename } from "./filenames.js";
import { MAX_IMAGE_PIXELS, readImageSize } from "./image-transforms.js";
import {
  AssetInUseError,
  AssetNotFoundError,
  ImageTooLargeError,
  UnreadableImageError,
} from "./media.errors.js";
import {
  type AssetChanges,
  deleteAssetRow,
  findAssetById,
  findAssetIdByContentHash,
  insertAsset,
  listAssetRows,
  updateAssetRow,
} from "./media.repository.js";
import type { Asset, ListAssetsQuery, UpdateAssetRequest } from "./media.schema.js";
import type { StorageDriver } from "./storage-driver.js";
import { assertSvgIsSafe } from "./svg-safety.js";
import { removeCachedTransforms } from "./transform-cache.js";

/** Everything media's business rules need, gathered per request by the routes. */
export interface MediaContext {
  database: DatabaseOrTransaction;
  storage: StorageDriver;
  /** Where resized images are kept (see transform-cache.ts). */
  cacheFolder: string;
  /** The API's own address, for the absolute URLs in responses. */
  publicApiUrl: string;
  usageFinder: AssetUsageFinder;
}

export interface UploadedFile {
  /** The name it had on the uploader's computer. Cleaned before it is stored. */
  filename: string;
  contents: Buffer;
}

/**
 * Checks and stores an upload. The same bytes uploaded twice give back the first asset
 * (`created: false`) rather than a duplicate the editor would then have to tidy up.
 */
export async function uploadAsset(
  media: MediaContext,
  file: UploadedFile,
  uploadedBy: string,
): Promise<{ asset: Asset; created: boolean }> {
  const fileType = await detectFileType(file.contents, file.filename);
  const filename = sanitiseFilename(file.filename, fileType.extension);

  if (fileType.mimeType === "image/svg+xml") {
    assertSvgIsSafe(decodeAsText(file.contents) ?? "", filename);
  }
  const size = fileType.kind === "image" ? await readImageSize(file.contents) : undefined;
  if (fileType.kind === "image" && !size) {
    throw new UnreadableImageError(filename);
  }
  if (size && size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new ImageTooLargeError(filename, size.width, size.height, MAX_IMAGE_PIXELS / 1_000_000);
  }

  const contentHash = createHash("sha256").update(file.contents).digest("hex");
  const existingId = await findAssetIdByContentHash(media.database, DEFAULT_TENANT_ID, contentHash);
  if (existingId) {
    return { asset: await getAsset(media, existingId), created: false };
  }

  const assetId = randomUUID();
  // The tenant comes first so a shared bucket can later be split or permissioned per customer.
  const storageKey = `${DEFAULT_TENANT_ID}/${assetId}.${fileType.extension}`;
  await media.storage.put(storageKey, file.contents, fileType.mimeType);

  try {
    await insertAsset(media.database, {
      id: assetId,
      tenantId: DEFAULT_TENANT_ID,
      filename,
      storageKey,
      mimeType: fileType.mimeType,
      size: file.contents.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      contentHash,
      uploadedBy,
    });
  } catch (error) {
    await media.storage.delete(storageKey);
    // Someone uploaded the same file at the same moment; theirs won, so hand that one back.
    const racedId = isUniqueViolation(error)
      ? await findAssetIdByContentHash(media.database, DEFAULT_TENANT_ID, contentHash)
      : undefined;
    if (!racedId) {
      throw error;
    }
    return { asset: await getAsset(media, racedId), created: false };
  }

  return { asset: await getAsset(media, assetId), created: true };
}

export async function listAssets(
  media: MediaContext,
  query: ListAssetsQuery,
): Promise<{ assets: Asset[]; total: number }> {
  const { rows, total } = await listAssetRows(media.database, DEFAULT_TENANT_ID, {
    search: query.search,
    kind: query.type,
    limit: query.perPage,
    offset: (query.page - 1) * query.perPage,
  });
  return { assets: rows.map((row) => toAssetResponse(row, media.publicApiUrl)), total };
}

export async function getAsset(media: MediaContext, assetId: string): Promise<Asset> {
  const row = await findAssetById(media.database, DEFAULT_TENANT_ID, assetId);
  if (!row) {
    throw new AssetNotFoundError();
  }
  return toAssetResponse(row, media.publicApiUrl);
}

/** A new filename keeps the extension of what the file really is, whatever was typed. */
export async function updateAsset(
  media: MediaContext,
  assetId: string,
  changes: UpdateAssetRequest,
): Promise<Asset> {
  const row = await findAssetById(media.database, DEFAULT_TENANT_ID, assetId);
  if (!row) {
    throw new AssetNotFoundError();
  }

  const extension = findAllowedFileType(row.mimeType)?.extension ?? "bin";
  const columns: AssetChanges = {};
  if (changes.alt !== undefined) {
    columns.alt = changes.alt;
  }
  if (changes.focalPoint) {
    columns.focalX = changes.focalPoint.x;
    columns.focalY = changes.focalPoint.y;
  }
  if (changes.filename !== undefined) {
    columns.filename = sanitiseFilename(changes.filename, extension);
  }

  // An empty PATCH is allowed and changes nothing (the database refuses an empty update).
  if (Object.keys(columns).length > 0) {
    await updateAssetRow(media.database, DEFAULT_TENANT_ID, assetId, columns);
  }
  return getAsset(media, assetId);
}

/** Refused with the list of entries while anything still uses the asset. */
export async function deleteAsset(media: MediaContext, assetId: string): Promise<void> {
  const row = await findAssetById(media.database, DEFAULT_TENANT_ID, assetId);
  if (!row) {
    throw new AssetNotFoundError();
  }

  const usedBy = await media.usageFinder.findEntriesUsingAsset(assetId);
  if (usedBy.length > 0) {
    throw new AssetInUseError(usedBy);
  }

  // The row goes first: a file left behind by a failure after this is invisible and harmless,
  // where a row whose file had gone would show a broken image.
  await deleteAssetRow(media.database, DEFAULT_TENANT_ID, assetId);
  await media.storage.delete(row.storageKey);
  await removeCachedTransforms(media.cacheFolder, assetId);
}

function isUniqueViolation(error: unknown): boolean {
  return findErrorCode(error) === "23505";
}
