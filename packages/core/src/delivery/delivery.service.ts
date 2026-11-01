import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionOrFail } from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { resolveLocale } from "../sites/locales.service.js";
import { findTaxonomyOrFail } from "../taxonomies/taxonomies.service.js";
import { TermNotFoundError } from "../taxonomies/taxonomies.errors.js";
import { findTermBySlug } from "../taxonomies/terms.repository.js";
import { lookUpReferences } from "./delivered-references.js";
import { collectImageIds, deliverValues } from "./delivered-values.js";
import { PublishedEntryNotFoundError } from "./delivery.errors.js";
import {
  countPublishedEntries,
  findPublishedEntryBySlug,
  listPublishedEntries,
  listPublishedTranslations,
  type PublishedEntryFilter,
  type PublishedEntryRow,
} from "./delivery.repository.js";
import type {
  DeliveredEntry,
  DeliveredEntryWithTranslations,
  DeliveredList,
  DeliveryListQuery,
} from "./delivery.schema.js";
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
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const { locale } = await resolveLocale(database, query.locale);
  const filter: PublishedEntryFilter = {
    collectionId: collection.id,
    locale,
    withTerm: await findTermFilter(database, blueprint.fields, query),
  };
  const page = { limit: query.perPage, offset: (query.page - 1) * query.perPage };
  const rows = await listPublishedEntries(database, filter, collection.structure === "dated", page);
  return {
    items: await deliverEntries(database, collection, blueprint.fields, rows, assetLookup),
    total: await countPublishedEntries(database, filter),
  };
}

/**
 * `?taxonomy=tags&term=recipes` keeps entries that chose that term in any of the
 * blueprint's terms fields for that taxonomy. A blueprint without such a field matches
 * nothing, which is the honest answer.
 */
async function findTermFilter(
  database: DatabaseOrTransaction,
  fields: readonly FieldDefinition[],
  query: Pick<DeliveryListQuery, "taxonomy" | "term">,
): Promise<PublishedEntryFilter["withTerm"]> {
  if (query.taxonomy === undefined && query.term === undefined) {
    return undefined;
  }
  const taxonomy = await findTaxonomyOrFail(database, query.taxonomy ?? "");
  const term = await findTermBySlug(database, taxonomy.id, query.term ?? "");
  if (!term) {
    throw new TermNotFoundError();
  }
  const fieldHandles = fields
    .filter((field) => field.type === "terms" && field.options.taxonomy === taxonomy.handle)
    .map((field) => field.handle);
  // No field can hold the term: filter on a field that can't exist, so nothing matches.
  return { termId: term.id, fieldHandles: fieldHandles.length > 0 ? fieldHandles : [""] };
}

export async function findDeliveredEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  slug: string,
  requestedLocale: string | undefined,
  assetLookup: AssetLookup,
): Promise<DeliveredEntryWithTranslations> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const { locale } = await resolveLocale(database, requestedLocale);
  const row = await findPublishedEntryBySlug(
    database,
    { collectionId: collection.id, locale },
    slug,
  );
  if (!row) {
    throw new PublishedEntryNotFoundError(slug);
  }
  const [delivered] = await deliverEntries(
    database,
    collection,
    blueprint.fields,
    [row],
    assetLookup,
  );
  if (!delivered) {
    throw new PublishedEntryNotFoundError(slug);
  }
  const family = await listPublishedTranslations(database, row.originId ?? row.id);
  return {
    ...delivered,
    translations: family
      .filter((member) => member.id !== row.id)
      .map((member) => ({
        locale: member.locale,
        slug: member.slug,
        url: buildEntryUrl(collection.routePattern, member),
      })),
  };
}

/** Images, terms and linked entries for all the entries are looked up in one go. */
async function deliverEntries(
  database: DatabaseOrTransaction,
  collection: Collection,
  fields: readonly FieldDefinition[],
  rows: readonly PublishedEntryRow[],
  assetLookup: AssetLookup,
): Promise<DeliveredEntry[]> {
  const dataList = rows.map((row) => row.publishedData);
  const imageIds = collectImageIds(fields, dataList);
  const assets = imageIds.length > 0 ? await assetLookup.findAssetsByIds(imageIds) : new Map();
  const locale = rows[0]?.locale ?? "";
  const references = await lookUpReferences(database, fields, dataList, locale);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    url: buildEntryUrl(collection.routePattern, row),
    locale: row.locale,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    data: deliverValues(fields, row.publishedData, assets, references),
  }));
}
