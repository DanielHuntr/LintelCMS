/**
 * What other features use from media. Everything else in this folder is internal.
 * See README.md, "Using media from another feature", for how each piece is wired.
 */
export {
  createAssetLookup,
  noAssetUsage,
  type AssetExists,
  type AssetLookup,
  type AssetLookupSource,
  type AssetUsageFinder,
  type DeliveredAsset,
} from "./asset-lookup.js";
export type { AssetUsage } from "./media.errors.js";
export { assetSchema, focalPointSchema, type Asset, type FocalPoint } from "./media.schema.js";
export { LocalDiskStorage } from "./local-disk-storage.js";
export { StoredFileMissingError, type StorageDriver } from "./storage-driver.js";
