import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { assetFileUrl } from "./asset-response.js";
import type { AssetUsage } from "./media.errors.js";
import { findAssetsByIdList } from "./media.repository.js";
import type { FocalPoint } from "./media.schema.js";
import { type PhotoCredit, photoCreditFor } from "./photo-credit.js";

/**
 * How other features use media without reaching into its tables: the entries feature
 * checks that image fields point at real assets, the delivery API expands them, and
 * deleting an asset asks the entries feature whether anything still uses it.
 */

/** An image as the public delivery API shows it inside an entry. */
export interface DeliveredAsset {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalPoint: FocalPoint;
  /**
   * The credit to show under the picture, when its licence asks for one or someone typed
   * one; null otherwise (and for CC0 and Public Domain Mark photos). See photo-credit.ts.
   */
  credit: PhotoCredit | null;
}

export interface AssetLookup {
  /** The assets that exist, keyed by id. Ids that don't exist are simply missing from the map. */
  findAssetsByIds(assetIds: readonly string[]): Promise<Map<string, DeliveredAsset>>;
}

export interface AssetExists {
  assetExists(assetId: string): Promise<boolean>;
}

/** Answers "which entries use this asset?" so an asset in use isn't deleted from under them. */
export interface AssetUsageFinder {
  findEntriesUsingAsset(assetId: string): Promise<AssetUsage[]>;
}

/**
 * What the lookups read from. A Fastify server has both properties, so `createAssetLookup(server)`
 * works in routes; `database` is read on every call, so it follows the setup screen switching
 * databases. Pass `{ database: transaction, publicApiUrl }` to look up inside a transaction.
 */
export interface AssetLookupSource {
  readonly database: DatabaseOrTransaction;
  readonly publicApiUrl: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAssetLookup(source: AssetLookupSource): AssetLookup & AssetExists {
  async function findAssetsByIds(assetIds: readonly string[]) {
    // Entry data is typed by people and scripts; a stray non-UUID would make Postgres fail the query.
    const validIds = [...new Set(assetIds)].filter((assetId) => UUID_PATTERN.test(assetId));
    const rows = await findAssetsByIdList(source.database, DEFAULT_TENANT_ID, validIds);
    return new Map(
      rows.map((row): [string, DeliveredAsset] => [
        row.id,
        {
          id: row.id,
          url: assetFileUrl(source.publicApiUrl, row),
          alt: row.alt,
          width: row.width,
          height: row.height,
          focalPoint: { x: row.focalX, y: row.focalY },
          credit: photoCreditFor(row),
        },
      ]),
    );
  }

  async function assetExists(assetId: string) {
    return (await findAssetsByIds([assetId])).has(assetId);
  }

  return { findAssetsByIds, assetExists };
}

/**
 * Media on its own can't see inside entries, so on its own nothing counts as in use. The
 * entries feature knows which fields hold images and provides the real finder, passed to
 * `buildServer` in server.ts.
 */
export const noAssetUsage: AssetUsageFinder = {
  findEntriesUsingAsset: async () => [],
};
