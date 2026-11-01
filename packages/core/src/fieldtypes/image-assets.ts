/**
 * What the image fieldtype needs from the media library. Content doesn't import media
 * code; the server hands these in (see `buildServer` in server.ts), so the two features
 * can change independently.
 */

/** An image as the public delivery API shows it. */
export interface DeliveredAsset {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalPoint: { x: number; y: number } | null;
}

/** Looks up several images in one go, for the delivery API. Unknown ids are left out. */
export interface AssetLookup {
  findAssetsByIds(assetIds: readonly string[]): Promise<Map<string, DeliveredAsset>>;
}

/** Whether an image with this id is in the media library, checked when an entry is saved. */
export type AssetExists = (assetId: string) => Promise<boolean>;

/**
 * Until the media library is wired in, every image id is accepted (the fieldtype has
 * already checked it is a uuid) and none can be expanded, so content works on its own.
 */
export const acceptAnyAsset: AssetExists = async () => true;

export const findNoAssets: AssetLookup = {
  findAssetsByIds: async () => new Map(),
};
