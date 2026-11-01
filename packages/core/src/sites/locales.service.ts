import type { DatabaseOrTransaction } from "../database/client.js";
import {
  DefaultLocaleRemovalError,
  LocaleAlreadyAddedError,
  LocaleInUseError,
  LocaleNotFoundError,
} from "./locales.errors.js";
import {
  countEntriesInLocale,
  deleteSiteLocale,
  findSiteLocale,
  insertSiteLocaleIfMissing,
  listSiteLocales,
  renameSiteLocale,
} from "./locales.repository.js";
import {
  type AddLocaleRequest,
  type LocaleListResponse,
  type LocaleResponse,
  localeCodeSchema,
  type RenameLocaleRequest,
} from "./locales.schema.js";
import type { SiteLocale } from "./locales.table.js";
import { findOrCreateDefaultSite } from "./sites.service.js";
import type { Site } from "./sites.table.js";

/**
 * The languages of the site. There is always at least one, the site's default (its
 * `locale`); more are added in Settings. Entries and global values are kept per locale.
 */

/** The English name of a language tag, such as "French (France)" for "fr-FR". */
export function describeLanguage(code: string): string {
  return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
}

/** The default site, with a row for its default locale (made the first time it's needed). */
export async function findSiteWithLocales(database: DatabaseOrTransaction): Promise<Site> {
  const site = await findOrCreateDefaultSite(database);
  await insertSiteLocaleIfMissing(database, {
    siteId: site.id,
    code: site.locale,
    name: describeLanguage(site.locale),
  });
  return site;
}

export async function listLocales(database: DatabaseOrTransaction): Promise<LocaleListResponse> {
  const site = await findSiteWithLocales(database);
  const locales = await listSiteLocales(database, site.id);
  return {
    defaultLocale: site.locale,
    locales: locales
      .map((locale) => describeLocale(site, locale, locale.entryCount))
      // The default comes first, then the others in the order they were added.
      .sort((first, second) => Number(second.isDefault) - Number(first.isDefault)),
  };
}

function describeLocale(site: Site, locale: SiteLocale, entryCount: number): LocaleResponse {
  return {
    code: locale.code,
    name: locale.name,
    isDefault: locale.code === site.locale,
    entryCount,
  };
}

export async function addLocale(
  database: DatabaseOrTransaction,
  request: AddLocaleRequest,
): Promise<LocaleResponse> {
  const site = await findSiteWithLocales(database);
  const name = request.name ?? describeLanguage(request.code);
  const inserted = await insertSiteLocaleIfMissing(database, {
    siteId: site.id,
    code: request.code,
    name,
  });
  if (!inserted) {
    throw new LocaleAlreadyAddedError(name);
  }
  return describeLocale(site, inserted, 0);
}

export async function renameLocale(
  database: DatabaseOrTransaction,
  code: string,
  request: RenameLocaleRequest,
): Promise<LocaleResponse> {
  const { site, locale } = await findLocaleOrFail(database, code);
  await renameSiteLocale(database, locale.id, request.name);
  const entryCount = await countEntriesInLocale(database, site.id, locale.code);
  return describeLocale(site, { ...locale, name: request.name }, entryCount);
}

/**
 * Removes a language the site no longer offers. Refused for the default, and while
 * entries are written in it. Global values saved in it are kept, and come back if the
 * language is added again.
 */
export async function removeLocale(database: DatabaseOrTransaction, code: string): Promise<void> {
  const { site, locale } = await findLocaleOrFail(database, code);
  if (locale.code === site.locale) {
    throw new DefaultLocaleRemovalError(locale.name);
  }
  const entryCount = await countEntriesInLocale(database, site.id, locale.code);
  if (entryCount > 0) {
    throw new LocaleInUseError(locale.name, entryCount);
  }
  await deleteSiteLocale(database, locale.id);
}

/** The locale with this code, written any way round ("FR-fr" finds "fr-FR"), or a 404. */
export async function findLocaleOrFail(
  database: DatabaseOrTransaction,
  code: string,
): Promise<{ site: Site; locale: SiteLocale }> {
  const site = await findSiteWithLocales(database);
  const parsed = localeCodeSchema.safeParse(code);
  const locale = parsed.success ? await findSiteLocale(database, site.id, parsed.data) : undefined;
  if (!locale) {
    throw new LocaleNotFoundError(code);
  }
  return { site, locale };
}

/**
 * The locale a request is about: the one asked for (which must be one of the site's), or
 * the site's default when none was given.
 */
export async function resolveLocale(
  database: DatabaseOrTransaction,
  requested: string | undefined,
): Promise<{ site: Site; locale: string }> {
  if (requested === undefined) {
    const site = await findSiteWithLocales(database);
    return { site, locale: site.locale };
  }
  const { site, locale } = await findLocaleOrFail(database, requested);
  return { site, locale: locale.code };
}
