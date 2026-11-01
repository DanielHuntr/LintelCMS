import type { DatabaseOrTransaction } from "../database/client.js";
import { lookUpReferences } from "../delivery/delivered-references.js";
import { collectImageIds, deliverValues } from "../delivery/delivered-values.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { resolveLocale } from "../sites/locales.service.js";
import type { Site } from "../sites/sites.table.js";
import { listGlobalSetRows } from "./global-sets.repository.js";
import { findAllGlobalValues } from "./global-values.repository.js";
import { findGlobalSetOrFail } from "./globals.service.js";
import type { DeliveredGlobalSet } from "./globals.schema.js";
import type { GlobalSet, GlobalValues } from "./globals.table.js";

/**
 * Global sets for websites, with values expanded like an entry's (images, rich text,
 * terms...). A language with nothing saved of its own gets the main language's values.
 * Values are the site's own: the one asked for, or the default site.
 */

export async function deliverGlobalSet(
  database: DatabaseOrTransaction,
  handle: string,
  requestedLocale: string | undefined,
  assetLookup: AssetLookup,
  forSite?: Site,
): Promise<DeliveredGlobalSet> {
  const globalSet = await findGlobalSetOrFail(database, handle);
  const [delivered] = await deliverGlobalSets(
    database,
    [globalSet],
    requestedLocale,
    assetLookup,
    forSite,
  );
  if (!delivered) {
    throw new Error(`The global set ${handle} could not be delivered.`);
  }
  return delivered;
}

/** Every global set at once, keyed by handle, for sites that print them on every page. */
export async function deliverAllGlobalSets(
  database: DatabaseOrTransaction,
  requestedLocale: string | undefined,
  assetLookup: AssetLookup,
  forSite?: Site,
): Promise<{ locale: string; globals: Record<string, Record<string, unknown>> }> {
  const globalSets = await listGlobalSetRows(database, DEFAULT_TENANT_ID);
  const delivered = await deliverGlobalSets(
    database,
    globalSets,
    requestedLocale,
    assetLookup,
    forSite,
  );
  const { locale } = await resolveLocale(database, requestedLocale, forSite);
  return {
    locale,
    globals: Object.fromEntries(delivered.map((globalSet) => [globalSet.handle, globalSet.data])),
  };
}

async function deliverGlobalSets(
  database: DatabaseOrTransaction,
  globalSets: readonly GlobalSet[],
  requestedLocale: string | undefined,
  assetLookup: AssetLookup,
  forSite?: Site,
): Promise<DeliveredGlobalSet[]> {
  const { site, locale } = await resolveLocale(database, requestedLocale, forSite);
  const rows = await findAllGlobalValues(database, site.id, [locale, site.locale]);
  const dataFor = (globalSet: GlobalSet) =>
    valuesIn(rows, globalSet.id, locale) ?? valuesIn(rows, globalSet.id, site.locale) ?? {};

  const fields = globalSets.flatMap((globalSet) => globalSet.fields);
  const dataList = globalSets.map(dataFor);
  const imageIds = collectImageIds(fields, dataList);
  const assets = imageIds.length > 0 ? await assetLookup.findAssetsByIds(imageIds) : new Map();
  const references = await lookUpReferences(database, fields, dataList, locale);

  return globalSets.map((globalSet) => ({
    handle: globalSet.handle,
    name: globalSet.name,
    locale,
    data: deliverValues(globalSet.fields, dataFor(globalSet), assets, references),
  }));
}

function valuesIn(
  rows: readonly GlobalValues[],
  globalSetId: string,
  locale: string,
): Record<string, unknown> | undefined {
  return rows.find((row) => row.globalSetId === globalSetId && row.locale === locale)?.data;
}
