import {
  findCollectionByIdOrFail,
  isCollectionOnSite,
} from "../collections/collections.service.js";
import { CollectionNotOnSiteError } from "../collections/collections.errors.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import { findSiteLocale } from "../sites/locales.repository.js";
import type { Site } from "../sites/sites.table.js";
import { SameSiteCopyError, SharedEntryCopyError } from "./entries.errors.js";
import { findSlugsStartingWith } from "./entries.repository.js";
import type { EntryResponse } from "./entries.schema.js";
import { createEntry, type EntryChangeContext, findEntryOrFail } from "./entries.service.js";
import { firstFreeSlug } from "./slugs.js";

/**
 * "Copy to site": a new draft on another site with the same values (the saved working copy),
 * for starting a page on the French site from the UK one. The copy keeps the slug where
 * that is free, is written in the same language if the other site has it (else in its main
 * language), and starts at the top of a page tree. It isn't linked to the original:
 * translations live within one site, and each site's copy goes its own way from here.
 */
export async function copyEntryToSite(
  database: DatabaseOrTransaction,
  entryId: string,
  target: Site,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  if (collection.siteScope === "shared") {
    throw new SharedEntryCopyError(collection.name);
  }
  if (target.id === entry.siteId) {
    throw new SameSiteCopyError(target.name);
  }
  if (!isCollectionOnSite(collection, target)) {
    throw new CollectionNotOnSiteError(collection.handle, target.name);
  }

  const site = await findSiteWithLocales(database, target);
  const sameLanguage = await findSiteLocale(database, site.id, entry.locale);
  const locale = sameLanguage ? entry.locale : site.locale;
  const taken = await findSlugsStartingWith(
    database,
    { collectionId: collection.id, siteId: site.id, locale },
    entry.slug,
  );
  return createEntry(
    database,
    collection.handle,
    { data: entry.data, slug: firstFreeSlug(entry.slug, new Set(taken)), locale },
    context,
    site,
  );
}
