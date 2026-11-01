import { removeSiteFromCollections } from "../collections/collections.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { copyMenusToSite } from "../navigation/navigation.service.js";
import { removeSiteFromRoles } from "../roles/roles.repository.js";
import { describeLanguage, findSiteWithLocales } from "./locales.service.js";
import {
  findSiteLocale,
  insertSiteLocaleIfMissing,
  listSiteLocales,
} from "./locales.repository.js";
import { findAddressClash } from "./site-addresses.js";
import {
  DefaultSiteRemovalError,
  SiteAddressTakenError,
  SiteHandleTakenError,
  SiteHasEntriesError,
  SiteLocaleMissingError,
} from "./sites.errors.js";
import {
  countEntriesInSite,
  deleteSiteRow,
  findHighestSortOrder,
  insertSiteIfMissing,
  listSitesWithEntryCounts,
  updateSiteRow,
} from "./sites.repository.js";
import type {
  CreateSiteRequest,
  DeliveredSite,
  SiteResponse,
  UpdateSiteRequest,
} from "./sites.schema.js";
import {
  findOrCreateDefaultSite,
  findSiteOrFail,
  isDefaultSite,
  listAllSites,
} from "./sites.service.js";
import type { Site, SiteBranding } from "./sites.table.js";

/**
 * Settings → Sites: adding, changing and removing the sites this install serves. Each new
 * site starts with its languages and with empty copies of the default site's menus, so a
 * website asking for "main" gets a menu on every site.
 */

const NO_BRANDING: SiteBranding = { logoAssetId: null, accentColor: null };

async function describeSite(
  database: DatabaseOrTransaction,
  site: Site,
  entryCount: number,
): Promise<SiteResponse> {
  await findSiteWithLocales(database, site);
  const locales = await listSiteLocales(database, site.id);
  return {
    id: site.id,
    handle: site.handle,
    name: site.name,
    isDefault: isDefaultSite(site),
    hostnames: site.hostnames,
    pathPrefix: site.pathPrefix,
    siteUrl: site.siteUrl,
    defaultLocale: site.locale,
    // The main language first, then the others in the order they were added.
    locales: locales
      .map(({ code, name }) => ({ code, name }))
      .sort(
        (first, second) => Number(second.code === site.locale) - Number(first.code === site.locale),
      ),
    branding: { ...NO_BRANDING, ...site.branding },
    entryCount,
  };
}

/** Every site, or only those in `allowedSiteIds` for someone limited to some. */
export async function listSites(
  database: DatabaseOrTransaction,
  allowedSiteIds: readonly string[] | null = null,
): Promise<{ sites: SiteResponse[] }> {
  await findOrCreateDefaultSite(database);
  const rows = await listSitesWithEntryCounts(database, DEFAULT_TENANT_ID);
  const visible = rows.filter(
    (site) => allowedSiteIds === null || allowedSiteIds.includes(site.id),
  );
  const sites: SiteResponse[] = [];
  for (const site of visible) {
    sites.push(await describeSite(database, site, site.entryCount));
  }
  return { sites };
}

export async function findSite(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<SiteResponse> {
  const site = await findSiteOrFail(database, handle);
  return describeSite(database, site, await countEntriesInSite(database, site.id));
}

/** What a website needs to know about every site, for routing and language switchers. */
export async function listDeliveredSites(
  database: DatabaseOrTransaction,
): Promise<{ sites: DeliveredSite[] }> {
  const { sites } = await listSites(database);
  return { sites: sites.map(deliverSite) };
}

export function deliverSite(site: SiteResponse): DeliveredSite {
  return {
    handle: site.handle,
    name: site.name,
    isDefault: site.isDefault,
    hostnames: site.hostnames,
    pathPrefix: site.pathPrefix,
    siteUrl: site.siteUrl,
    defaultLocale: site.defaultLocale,
    locales: site.locales,
    branding: site.branding,
  };
}

async function checkAddressIsFree(
  database: DatabaseOrTransaction,
  address: Pick<Site, "hostnames" | "pathPrefix">,
  exceptSiteId?: string,
): Promise<void> {
  const others = (await listAllSites(database)).filter((site) => site.id !== exceptSiteId);
  const clash = findAddressClash(address, others);
  if (clash) {
    throw new SiteAddressTakenError(clash.hostname, clash.siteName);
  }
}

export async function createSite(
  database: DatabaseOrTransaction,
  request: CreateSiteRequest,
): Promise<SiteResponse> {
  const defaultSite = await findOrCreateDefaultSite(database);
  await checkAddressIsFree(database, request);
  const site = await database.transaction(async (transaction) => {
    const inserted = await insertSiteIfMissing(transaction, {
      handle: request.handle,
      name: request.name,
      domain: request.hostnames[0] ?? "localhost",
      hostnames: request.hostnames,
      pathPrefix: request.pathPrefix,
      siteUrl: request.siteUrl,
      locale: request.defaultLocale,
      branding: { ...NO_BRANDING, ...request.branding },
      sortOrder: (await findHighestSortOrder(transaction, DEFAULT_TENANT_ID)) + 1,
    });
    if (!inserted) {
      throw new SiteHandleTakenError(request.handle);
    }
    for (const code of [request.defaultLocale, ...request.extraLocales]) {
      await insertSiteLocaleIfMissing(transaction, {
        siteId: inserted.id,
        code,
        name: describeLanguage(code),
      });
    }
    await copyMenusToSite(transaction, defaultSite, inserted);
    return inserted;
  });
  return describeSite(database, site, 0);
}

export async function updateSite(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateSiteRequest,
): Promise<SiteResponse> {
  const site = await findSiteWithLocales(database, await findSiteOrFail(database, handle));
  const hostnames = request.hostnames ?? site.hostnames;
  const pathPrefix = request.pathPrefix ?? site.pathPrefix;
  if (request.hostnames !== undefined || request.pathPrefix !== undefined) {
    await checkAddressIsFree(database, { hostnames, pathPrefix }, site.id);
  }
  if (request.defaultLocale !== undefined) {
    const locale = await findSiteLocale(database, site.id, request.defaultLocale);
    if (!locale) {
      throw new SiteLocaleMissingError(site.name, request.defaultLocale);
    }
  }
  await updateSiteRow(database, site.id, {
    name: request.name,
    hostnames,
    domain: hostnames[0] ?? "localhost",
    pathPrefix,
    siteUrl: request.siteUrl,
    locale: request.defaultLocale,
    branding: request.branding
      ? { ...NO_BRANDING, ...site.branding, ...request.branding }
      : undefined,
  });
  return findSite(database, handle);
}

/**
 * Removes a site with its languages, menus, global values and own taxonomies. Refused for
 * the default site, and while entries belong to it. Files in its media folder move to the
 * shared library rather than being deleted.
 */
export async function deleteSite(database: DatabaseOrTransaction, handle: string): Promise<void> {
  const site = await findSiteOrFail(database, handle);
  if (isDefaultSite(site)) {
    throw new DefaultSiteRemovalError(site.name);
  }
  const entryCount = await countEntriesInSite(database, site.id);
  if (entryCount > 0) {
    throw new SiteHasEntriesError(site.name, entryCount);
  }
  await database.transaction(async (transaction) => {
    await removeSiteFromRoles(transaction, site.id);
    await removeSiteFromCollections(transaction, site.id);
    await deleteSiteRow(transaction, site.id);
  });
}
