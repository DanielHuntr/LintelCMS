import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { toAssetResponse } from "./asset-response.js";
import {
  AssetAlreadyInLibraryError,
  AssetInUseError,
  AssetNotFoundError,
  BinnedAssetNotFoundError,
  BinnedFileMissingError,
} from "./media.errors.js";
import {
  deleteAssetRow,
  findAssetById,
  findAssetIdByContentHash,
  insertAsset,
} from "./media.repository.js";
import type { Asset } from "./media.schema.js";
import type { MediaContext } from "./media.service.js";
import {
  deleteBinnedAssetRow,
  findBinnedAsset,
  insertBinnedAsset,
  listAllBinnedAssets,
  listBinnedAssetRows,
  siteExists,
  userExists,
} from "./media-bin.repository.js";
import type { AssetRow } from "./media.table.js";
import { removeCachedTransforms } from "./transform-cache.js";

/**
 * The media library's recycle bin. Deleting a file in the library keeps its row here and
 * its bytes in storage, so Undo (or Restore in the recycle bin) brings it back with the same
 * id. Deleting it from the bin, or emptying the bin, removes the bytes for good.
 *
 * Files are binned only when nothing uses them, as deleting always required.
 */

const LIST_LIMIT = 200;

export interface BinnedAssetListItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
}

/** Moves a file to the bin. Answers the row it was, for the "asset.deleted" event. */
export async function moveAssetToRecycleBin(
  media: MediaContext,
  assetId: string,
  deletedBy: string | null,
): Promise<AssetRow> {
  const row = await findAssetById(media.database, DEFAULT_TENANT_ID, assetId);
  if (!row) {
    throw new AssetNotFoundError();
  }
  const usedBy = await media.usageFinder.findEntriesUsingAsset(assetId);
  if (usedBy.length > 0) {
    throw new AssetInUseError(usedBy);
  }
  await media.database.transaction(async (transaction) => {
    await insertBinnedAsset(transaction, {
      id: row.id,
      filename: row.filename,
      asset: {
        siteId: row.siteId,
        filename: row.filename,
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        size: row.size,
        width: row.width,
        height: row.height,
        alt: row.alt,
        focalX: row.focalX,
        focalY: row.focalY,
        contentHash: row.contentHash,
        uploadedBy: row.uploadedBy,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      deletedBy,
    });
    await deleteAssetRow(transaction, DEFAULT_TENANT_ID, assetId);
  });
  // Resized copies are made again on demand if it comes back.
  await removeCachedTransforms(media.cacheFolder, assetId);
  return row;
}

export async function listBinnedAssets(
  media: MediaContext,
): Promise<{ items: BinnedAssetListItem[] }> {
  const rows = await listBinnedAssetRows(media.database, DEFAULT_TENANT_ID, LIST_LIMIT);
  return {
    items: rows.map(({ binned, deletedByName }) => ({
      id: binned.id,
      filename: binned.filename,
      mimeType: binned.asset.mimeType,
      size: binned.asset.size,
      deletedAt: binned.deletedAt.toISOString(),
      deletedBy:
        binned.deletedBy !== null && deletedByName !== null
          ? { id: binned.deletedBy, name: deletedByName }
          : null,
    })),
  };
}

/**
 * Puts a file back in the library with its id, name, alt text and folder. A site folder
 * deleted meanwhile puts it in the shared library instead.
 */
export async function restoreBinnedAsset(media: MediaContext, assetId: string): Promise<Asset> {
  const binned = await findBinnedAsset(media.database, DEFAULT_TENANT_ID, assetId);
  if (!binned) {
    throw new BinnedAssetNotFoundError();
  }
  const { asset } = binned;
  if (await findAssetIdByContentHash(media.database, DEFAULT_TENANT_ID, asset.contentHash)) {
    throw new AssetAlreadyInLibraryError(asset.filename);
  }
  if (!(await media.storage.exists(asset.storageKey))) {
    throw new BinnedFileMissingError(asset.filename);
  }
  const siteId =
    asset.siteId && (await siteExists(media.database, asset.siteId)) ? asset.siteId : null;
  const uploadedBy =
    asset.uploadedBy && (await userExists(media.database, asset.uploadedBy))
      ? asset.uploadedBy
      : null;
  await media.database.transaction(async (transaction) => {
    await insertAsset(transaction, {
      ...asset,
      id: binned.id,
      tenantId: binned.tenantId,
      siteId,
      uploadedBy,
      createdAt: new Date(asset.createdAt),
      updatedAt: new Date(asset.updatedAt),
    });
    await deleteBinnedAssetRow(transaction, DEFAULT_TENANT_ID, binned.id);
  });
  const restored = await findAssetById(media.database, DEFAULT_TENANT_ID, binned.id);
  if (!restored) {
    throw new AssetNotFoundError();
  }
  return toAssetResponse(restored, media.publicApiUrl);
}

/** Deletes a binned file for good: its row, then its bytes. */
export async function deleteBinnedAsset(media: MediaContext, assetId: string): Promise<void> {
  const binned = await findBinnedAsset(media.database, DEFAULT_TENANT_ID, assetId);
  if (!binned) {
    throw new BinnedAssetNotFoundError();
  }
  await forget(media, binned.id, binned.asset.storageKey);
}

/** Deletes every binned file for good. */
export async function emptyMediaBin(media: MediaContext): Promise<{ deleted: number }> {
  const binned = await listAllBinnedAssets(media.database, DEFAULT_TENANT_ID);
  for (const item of binned) {
    await forget(media, item.id, item.asset.storageKey);
  }
  return { deleted: binned.length };
}

// The row goes first: a file left behind by a failure after this is invisible and harmless.
async function forget(media: MediaContext, assetId: string, storageKey: string): Promise<void> {
  await deleteBinnedAssetRow(media.database, DEFAULT_TENANT_ID, assetId);
  await media.storage.delete(storageKey);
}
