import {
  adobeFontsService,
  combineConsentServices,
  type ConsentService,
  consentServicesInDesign,
  consentVersion,
  type CookieNoticePage,
  type CustomBlock,
  type CustomScriptRule,
  englishCookieNoticeLabels,
  listServiceNames,
} from "@lintel/builder-model";
import { loadBlockLibrary } from "../blocks/blocks.service.js";
import { listCollectionsWithDetails } from "../collections/collections.repository.js";
import { isCollectionOnSite } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findDeliveredEntryLinks } from "../delivery/delivered-references.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { readSetting } from "../settings/settings.service.js";
import { listSiteFontRows } from "../site-fonts/site-fonts.repository.js";
import { readSiteSections } from "../site-sections/site-sections.service.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { checkPageDesign } from "../website/designed-pages.js";
import {
  type CookieNoticeSettings,
  cookieNoticeSettingsSchema,
  defaultCookieNoticeSettings,
} from "./cookie-notice.schema.js";
import {
  findStoredCookieNotice,
  listPublishedDesigns,
  saveStoredCookieNotice,
} from "./cookie-notice.repository.js";
import { findPluginConsentServices } from "./plugin-consent-services.js";

/**
 * The cookie notice: on by default whenever the published site uses something that may set
 * cookies or contact another company, and only then. Which services that is comes from the
 * site itself (its published page designs, its navigation and footer, the site's blocks they
 * use, Adobe Fonts) and from the plugins that are on. The notice names them; nothing from
 * them loads until a visitor allows it. docs/decisions/0040-cookie-notice.md says why.
 */

/** The saved settings, or the defaults when nothing (or something unreadable) is saved. */
export async function readCookieNoticeSettings(
  database: DatabaseOrTransaction,
): Promise<CookieNoticeSettings> {
  const parsed = cookieNoticeSettingsSchema.safeParse(
    (await findStoredCookieNotice(database)) ?? {},
  );
  return parsed.success ? parsed.data : defaultCookieNoticeSettings;
}

/** Saves a change to any of the settings; the rest stay as they were. */
export async function updateCookieNoticeSettings(
  database: DatabaseOrTransaction,
  changes: Partial<CookieNoticeSettings>,
): Promise<CookieNoticeSettings> {
  const current = await readCookieNoticeSettings(database);
  const next = cookieNoticeSettingsSchema.parse({ ...current, ...changes });
  await saveStoredCookieNotice(database, next);
  return next;
}

/** Whether visitors see the notice, with these settings and these services. */
export function isCookieNoticeShown(
  settings: Pick<CookieNoticeSettings, "mode">,
  services: readonly ConsentService[],
): boolean {
  if (settings.mode === "off") return false;
  return settings.mode === "always" || services.length > 0;
}

/** What else the site's services depend on, worked out by whoever already has it. */
export interface ServicesContext {
  scriptRule: CustomScriptRule;
  /** The site uses Adobe Fonts (it has an Adobe Fonts stylesheet to link). */
  usesAdobeFonts: boolean;
  enabledPlugins: readonly string[];
}

/**
 * Every service the published site uses: in its pages' designs (every collection with
 * pages, every language), in its navigation and footer, in the site's own blocks those use,
 * Adobe Fonts, and the services of the plugins that are on (those they declare, and those
 * their settings ask for, like "Visitor counts"). Sorted by name, each once.
 */
export async function findSiteConsentServices(
  database: DatabaseOrTransaction,
  site: Site,
  context: ServicesContext,
): Promise<ConsentService[]> {
  const [collections, sections, library, fromPlugins] = await Promise.all([
    listCollectionsWithDetails(database, DEFAULT_TENANT_ID),
    readSiteSections(database, site),
    loadBlockLibrary(database),
    findPluginConsentServices(database, context.enabledPlugins),
  ]);
  const blocks = new Map<string, CustomBlock>(library.map((block) => [block.handle, block]));
  const defaultSite = collections.some((collection) => collection.siteScope === "shared")
    ? await findOrCreateDefaultSite(database)
    : site;
  const withPages = collections.filter(
    (collection) => collection.routePattern !== null && isCollectionOnSite(collection, site),
  );
  const designs = (
    await Promise.all(
      withPages.map((collection) =>
        listPublishedDesigns(database, {
          collectionId: collection.id,
          siteId: collection.siteScope === "shared" ? defaultSite.id : site.id,
        }),
      ),
    )
  ).flat();
  const fromPages = designs.flatMap((value) => {
    const design = checkPageDesign(value, context.scriptRule);
    return design ? consentServicesInDesign(design.root, blocks) : [];
  });
  const fromSections = [sections.navigation, sections.footer].flatMap((section) =>
    section ? consentServicesInDesign(section, blocks) : [],
  );
  return combineConsentServices(
    fromPages,
    fromSections,
    context.usesAdobeFonts ? [adobeFontsService] : [],
    fromPlugins,
  );
}

/** For the admin: the settings, the services the site uses and whether the notice shows. */
export async function describeCookieNotice(database: DatabaseOrTransaction, site: Site) {
  const [settings, scriptRule, enabledPlugins, usesAdobeFonts] = await Promise.all([
    readCookieNoticeSettings(database),
    readSetting(database, "builderCustomScripts"),
    findEnabledPluginIds(database),
    siteUsesAdobeFonts(database, site),
  ]);
  const services = await findSiteConsentServices(database, site, {
    scriptRule,
    usesAdobeFonts,
    enabledPlugins,
  });
  return { settings, services, shown: isCookieNoticeShown(settings, services) };
}

async function siteUsesAdobeFonts(database: DatabaseOrTransaction, site: Site): Promise<boolean> {
  const rows = await listSiteFontRows(database, DEFAULT_TENANT_ID, site.id);
  return rows.some((row) => row.source === "adobe" && row.sourceId);
}

export const defaultCookieNoticeHeading = "Cookies";

/** The notice's message: the site's own words (with `{services}` filled in), or Lintel's. */
export function cookieNoticeMessage(
  settings: Pick<CookieNoticeSettings, "message">,
  services: readonly ConsentService[],
): string {
  const names = listServiceNames(services);
  if (settings.message) {
    return settings.message.replaceAll("{services}", names || "other services");
  }
  return names
    ? `This site uses ${names}, which may set cookies. Nothing from ${services.length > 1 ? "them" : "it"} loads until you say so.`
    : "This site may use services from other companies, which may set cookies. Nothing from them loads until you say so.";
}

/** The notice's settings for every page of a site, but for the privacy page's address. */
export function buildCookieNoticePage(
  settings: CookieNoticeSettings,
  services: readonly ConsentService[],
  site: Pick<Site, "id">,
  fontStylesheets: readonly string[],
): Omit<CookieNoticePage, "privacyUrl"> {
  return {
    storageKey: `lintel-consent:${site.id}`,
    version: consentVersion(services),
    services: [...services],
    position: settings.position,
    heading: settings.heading || defaultCookieNoticeHeading,
    message: cookieNoticeMessage(settings, services),
    fontStylesheets: [...fontStylesheets],
    labels: englishCookieNoticeLabels,
  };
}

/** The privacy page's address in each language it is published in, by locale. */
export async function findPrivacyPageUrls(
  database: DatabaseOrTransaction,
  pageId: string | null,
  locales: readonly string[],
  localise: (url: string, locale: string) => string,
): Promise<Record<string, string>> {
  if (!pageId) return {};
  const found = await Promise.all(
    locales.map(async (locale) => {
      const link = (await findDeliveredEntryLinks(database, [pageId], locale)).get(pageId);
      return link?.url ? ([[locale, localise(link.url, locale)]] as const) : [];
    }),
  );
  return Object.fromEntries(found.flat());
}
