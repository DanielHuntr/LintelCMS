import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import {
  entrySiteFor,
  findCollectionByIdOrFail,
  findCollectionOrFail,
} from "../collections/collections.service.js";
import type { Collection } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { resolveLocale } from "../sites/locales.service.js";
import { findSiteByIdOrFail, siteOrDefault } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { findTaxonomyOrFail } from "../taxonomies/taxonomies.service.js";
import { TermNotFoundError } from "../taxonomies/taxonomies.errors.js";
import { findTermBySlug } from "../taxonomies/terms.repository.js";
import { lookUpReferences } from "./delivered-references.js";
import { collectImageIds, deliverValues } from "./delivered-values.js";
import { PublishedEntryNotFoundError } from "./delivery.errors.js";
import {
  countPublishedEntries,
  type DraftEntryRow,
  findDraftEntry,
  findPublishedEntryBySlug,
  listPublishedEntries,
  listPublishedTranslations,
  type PublishedEntryFilter,
} from "./delivery.repository.js";
import type {
  DeliveredEntry,
  DeliveredEntryWithTranslations,
  DeliveredList,
  DeliveryListQuery,
} from "./delivery.schema.js";
import { placeEntryUrls } from "../content-roots/content-roots.service.js";
import { buildEntryUrl } from "./entry-urls.js";

/**
 * Published content for websites and apps. Everything served here is the version kept
 * when the entry was last published, never the working copy editors are changing, unless
 * the request carries a preview token for that entry (see src/preview).
 *
 * Each request is for one site (the default when none is given): its own entries, or for a
 * shared collection the ones every site shows. Addresses carry the site's path prefix.
 */

/** What delivering needs from a row: published values, or a draft's for preview. */
interface EntryToDeliver {
  id: string;
  originId: string | null;
  locale: string;
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
  forSite?: Site,
): Promise<DeliveredList> {
  const site = await siteOrDefault(database, forSite);
  const collection = await findCollectionOrFail(database, collectionHandle, site);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const entrySite = await entrySiteFor(database, collection, site);
  const { locale } = await resolveLocale(database, query.locale, entrySite);
  const filter: PublishedEntryFilter = {
    collectionId: collection.id,
    siteId: entrySite.id,
    locale,
    withTerm: await findTermFilter(database, blueprint.fields, query, site),
  };
  const page = { limit: query.perPage, offset: (query.page - 1) * query.perPage };
  const rows = await listPublishedEntries(database, filter, collection.structure === "dated", page);
  return {
    items: await deliverEntries(
      database,
      collection,
      blueprint.fields,
      rows.map((row) => ({ ...row, values: row.publishedData })),
      assetLookup,
      site,
    ),
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
  site: Site,
): Promise<PublishedEntryFilter["withTerm"]> {
  if (query.taxonomy === undefined && query.term === undefined) {
    return undefined;
  }
  const taxonomy = await findTaxonomyOrFail(database, query.taxonomy ?? "", site);
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

/**
 * The published entry at this slug in the requested language, with links to its other
 * languages. With `previewEntryId` (from a checked preview token), that entry's draft is
 * served instead when it is the one at this slug, published or not.
 */
export async function findDeliveredEntry(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  slug: string,
  requestedLocale: string | undefined,
  assetLookup: AssetLookup,
  previewEntryId?: string,
  forSite?: Site,
): Promise<DeliveredEntryWithTranslations> {
  const site = await siteOrDefault(database, forSite);
  const collection = await findCollectionOrFail(database, collectionHandle, site);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const entrySite = await entrySiteFor(database, collection, site);
  const { locale } = await resolveLocale(database, requestedLocale, entrySite);
  const where = { collectionId: collection.id, siteId: entrySite.id, locale };
  if (previewEntryId) {
    const draft = await findDraftEntry(database, { ...where, slug });
    if (draft?.id === previewEntryId) {
      return deliverWithTranslations(
        database,
        collection,
        blueprint.fields,
        draftToDeliver(draft),
        assetLookup,
        site,
      );
    }
  }
  const row = await findPublishedEntryBySlug(database, where, slug);
  if (!row) {
    throw new PublishedEntryNotFoundError(slug);
  }
  return deliverWithTranslations(
    database,
    collection,
    blueprint.fields,
    { ...row, values: row.publishedData },
    assetLookup,
    site,
  );
}

/** An entry's draft as a website would get it once published, for live preview. */
export async function findDeliveredDraft(
  database: DatabaseOrTransaction,
  entryId: string,
  assetLookup: AssetLookup,
): Promise<
  | { collectionHandle: string; siteHandle: string; entry: DeliveredEntryWithTranslations }
  | undefined
> {
  const draft = await findDraftEntry(database, { entryId });
  if (!draft) {
    return undefined;
  }
  const collection = await findCollectionByIdOrFail(database, draft.collectionId);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const site = await findSiteByIdOrFail(database, draft.siteId);
  const entry = await deliverWithTranslations(
    database,
    collection,
    blueprint.fields,
    draftToDeliver(draft),
    assetLookup,
    site,
  );
  return { collectionHandle: collection.handle, siteHandle: site.handle, entry };
}

function draftToDeliver(draft: DraftEntryRow): EntryToDeliver {
  return { ...draft, values: draft.data };
}

async function deliverWithTranslations(
  database: DatabaseOrTransaction,
  collection: Collection,
  fields: readonly FieldDefinition[],
  entry: EntryToDeliver,
  assetLookup: AssetLookup,
  site: Site,
): Promise<DeliveredEntryWithTranslations> {
  const [delivered] = await deliverEntries(
    database,
    collection,
    fields,
    [entry],
    assetLookup,
    site,
  );
  if (!delivered) {
    throw new PublishedEntryNotFoundError(entry.slug);
  }
  const family = (await listPublishedTranslations(database, entry.originId ?? entry.id)).filter(
    (member) => member.id !== entry.id,
  );
  const urls = await placeEntryUrls(
    database,
    family.map((member) => ({
      id: member.id,
      url: buildEntryUrl(collection.routePattern, member),
    })),
    { site },
  );
  return {
    ...delivered,
    translations: family.map((member) => ({
      locale: member.locale,
      slug: member.slug,
      url: urls.get(member.id) ?? null,
    })),
  };
}

/** Images, terms and linked entries for all the entries are looked up in one go. */
async function deliverEntries(
  database: DatabaseOrTransaction,
  collection: Collection,
  fields: readonly FieldDefinition[],
  entries: readonly EntryToDeliver[],
  assetLookup: AssetLookup,
  site: Site,
): Promise<DeliveredEntry[]> {
  const dataList = entries.map((entry) => entry.values);
  const imageIds = collectImageIds(fields, dataList);
  const assets = imageIds.length > 0 ? await assetLookup.findAssetsByIds(imageIds) : new Map();
  const locale = entries[0]?.locale ?? "";
  const references = await lookUpReferences(database, fields, dataList, locale);
  // Addresses are put under their site start and their site's path prefix (see src/content-roots).
  const urls = await placeEntryUrls(
    database,
    entries.map((entry) => ({
      id: entry.id,
      // A draft that has never been published gets today's date in its address, as it would.
      url: buildEntryUrl(collection.routePattern, {
        slug: entry.slug,
        publishedAt: entry.publishedAt ?? new Date(),
      }),
    })),
    { site },
  );
  return entries.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    url: urls.get(entry.id) ?? null,
    locale: entry.locale,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    data: deliverValues(fields, entry.values, assets, references),
  }));
}
