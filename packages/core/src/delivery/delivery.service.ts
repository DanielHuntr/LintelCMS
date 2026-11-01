import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionOrFail } from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { collectImageIds, deliverValues } from "./delivered-values.js";
import { PublishedEntryNotFoundError } from "./delivery.errors.js";
import {
  countPublishedEntries,
  findPublishedEntryBySlug,
  listPublishedEntries,
  type PublishedEntryRow,
} from "./delivery.repository.js";
import type { DeliveredEntry, DeliveredList, DeliveryListQuery } from "./delivery.schema.js";
import { buildEntryUrl } from "./entry-urls.js";

/**
 * Published content for websites and apps. Everything served here is the version kept
 * when the entry was last published, never the working copy editors are changing.
 */

/** Newest first for dated collections; the hand-set order for the others. */
export async function listDeliveredEntries(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  query: DeliveryListQuery,
  assetLookup: AssetLookup,
): Promise<DeliveredList> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const page = { limit: query.perPage, offset: (query.page - 1) * query.perPage };
  const rows = await listPublishedEntries(
    database,
    collection.id,
    collection.structure === "dated",
    page,
  );
  return {
    items: await deliverEntries(database, collection, rows, assetLookup),
    total: await countPublishedEntries(database, collection.id),
  };
}

export async function findDeliveredEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  slug: string,
  assetLookup: AssetLookup,
): Promise<DeliveredEntry> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const row = await findPublishedEntryBySlug(database, collection.id, slug);
  if (!row) {
    throw new PublishedEntryNotFoundError(slug);
  }
  const [delivered] = await deliverEntries(database, collection, [row], assetLookup);
  if (!delivered) {
    throw new PublishedEntryNotFoundError(slug);
  }
  return delivered;
}

/** Images for all the entries are looked up in one go, not one entry at a time. */
async function deliverEntries(
  database: DatabaseOrTransaction,
  collection: Collection,
  rows: readonly PublishedEntryRow[],
  assetLookup: AssetLookup,
): Promise<DeliveredEntry[]> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const imageIds = collectImageIds(
    blueprint.fields,
    rows.map((row) => row.publishedData),
  );
  const assets = imageIds.length > 0 ? await assetLookup.findAssetsByIds(imageIds) : new Map();

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    url: buildEntryUrl(collection.routePattern, row),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    data: deliverValues(blueprint.fields, row.publishedData, assets),
  }));
}
