import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { collectImageIds, deliverValues } from "./delivered-values.js";
import { PublishedEntryNotFoundError } from "./delivery.errors.js";
import {
  countPublishedEntries,
  type DraftEntryRow,
  findDraftEntry,
  findPublishedEntryBySlug,
  listPublishedEntries,
} from "./delivery.repository.js";
import type { DeliveredEntry, DeliveredList, DeliveryListQuery } from "./delivery.schema.js";
import { buildEntryUrl } from "./entry-urls.js";

/**
 * Published content for websites and apps. Everything served here is the version kept
 * when the entry was last published, never the working copy editors are changing, unless
 * the request carries a preview token for that entry (see src/preview).
 */

/** What delivering needs from a row: published values, or a draft's for preview. */
interface EntryToDeliver {
  id: string;
  slug: string;
  publishedAt: Date | null;
  values: Record<string, unknown>;
}

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
    items: await deliverEntries(
      database,
      collection,
      rows.map((row) => ({ ...row, values: row.publishedData })),
      assetLookup,
    ),
    total: await countPublishedEntries(database, collection.id),
  };
}

/**
 * The published entry at this slug. With `previewEntryId` (from a checked preview token),
 * that entry's draft is served instead when it is the one at this slug, published or not.
 */
export async function findDeliveredEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  slug: string,
  assetLookup: AssetLookup,
  previewEntryId?: string,
): Promise<DeliveredEntry> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  if (previewEntryId) {
    const draft = await findDraftEntry(database, { collectionId: collection.id, slug });
    if (draft?.id === previewEntryId) {
      return deliverOne(database, collection, draftToDeliver(draft), assetLookup, slug);
    }
  }
  const row = await findPublishedEntryBySlug(database, collection.id, slug);
  if (!row) {
    throw new PublishedEntryNotFoundError(slug);
  }
  return deliverOne(database, collection, { ...row, values: row.publishedData }, assetLookup, slug);
}

/** An entry's draft as a website would get it once published, for live preview. */
export async function findDeliveredDraft(
  database: DatabaseOrTransaction,
  entryId: string,
  assetLookup: AssetLookup,
): Promise<{ collectionHandle: string; entry: DeliveredEntry } | undefined> {
  const draft = await findDraftEntry(database, { entryId });
  if (!draft) {
    return undefined;
  }
  const collection = await findCollectionByIdOrFail(database, draft.collectionId);
  const entry = await deliverOne(
    database,
    collection,
    draftToDeliver(draft),
    assetLookup,
    draft.slug,
  );
  return { collectionHandle: collection.handle, entry };
}

function draftToDeliver(draft: DraftEntryRow): EntryToDeliver {
  return { id: draft.id, slug: draft.slug, publishedAt: draft.publishedAt, values: draft.data };
}

async function deliverOne(
  database: DatabaseOrTransaction,
  collection: Collection,
  entry: EntryToDeliver,
  assetLookup: AssetLookup,
  slug: string,
): Promise<DeliveredEntry> {
  const [delivered] = await deliverEntries(database, collection, [entry], assetLookup);
  if (!delivered) {
    throw new PublishedEntryNotFoundError(slug);
  }
  return delivered;
}

/** Images for all the entries are looked up in one go, not one entry at a time. */
async function deliverEntries(
  database: DatabaseOrTransaction,
  collection: Collection,
  entries: readonly EntryToDeliver[],
  assetLookup: AssetLookup,
): Promise<DeliveredEntry[]> {
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const imageIds = collectImageIds(
    blueprint.fields,
    entries.map((entry) => entry.values),
  );
  const assets = imageIds.length > 0 ? await assetLookup.findAssetsByIds(imageIds) : new Map();

  return entries.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    // A draft that has never been published gets today's date in its address, as it would.
    url: buildEntryUrl(collection.routePattern, {
      slug: entry.slug,
      publishedAt: entry.publishedAt ?? new Date(),
    }),
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    data: deliverValues(blueprint.fields, entry.values, assets),
  }));
}
