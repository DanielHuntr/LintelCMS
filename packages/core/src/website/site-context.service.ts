import { createHash } from "node:crypto";
import { designBaseStylesheet } from "@lintel/builder/render";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import type { SiteTemplate } from "@lintel/site-components";
import { siteStylesheet } from "@lintel/site-components/server";
import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { listCollectionsWithDetails } from "../collections/collections.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { AssetLookup, DeliveredAsset } from "../fieldtypes/image-assets.js";
import { isSeoPluginEnabled } from "../seo/seo-enabled.js";
import type { SeoDefaults } from "../seo/seo-defaults.schema.js";
import { readSeoDefaults } from "../seo/seo-defaults.service.js";
import { isCollectionOnSite } from "../collections/collections.service.js";
import { readAddressForSite } from "../sites/site-address.service.js";
import type { Site } from "../sites/sites.table.js";
import { listLocales } from "../sites/locales.service.js";
import type { RoutedCollection } from "./site-routing.js";
import { readWebsiteLook, type WebsiteLook } from "./website.service.js";
import type { SiteEffectSettings } from "@lintel/motion/effects";
import { readSiteEffects } from "../site-effects/site-effects.service.js";
import { choiceLabelsOf } from "./bound-entries.js";
import {
  type CustomScriptRule,
  compileTagStyles,
  designVariablesStylesheet,
  type SiteDesign,
} from "@lintel/builder-model";
import { readSiteDesign } from "../site-design/site-design.service.js";
import { readSetting } from "../settings/settings.service.js";
import { readWebsiteFonts } from "../site-fonts/site-fonts.service.js";
import { websiteFontsStylesheet } from "../site-fonts/website-fonts.js";
import {
  adobeFontsService,
  type CookieNoticePage,
  type SiteFontChoice,
} from "@lintel/builder-model";
import {
  buildCookieNoticePage,
  findPrivacyPageUrls,
  findSiteConsentServices,
  isCookieNoticeShown,
  readCookieNoticeSettings,
} from "../cookie-notice/cookie-notice.service.js";
import { localiseUrl } from "./site-chrome.service.js";

/**
 * What every page of the built-in site needs, whatever its address: languages, which
 * collections have pages, the template and theme, and the stylesheet. Worked out once and
 * shared through the rendered pages cache until something changes.
 */
export interface SiteContext {
  defaultLocale: string;
  locales: Array<{ code: string; name: string }>;
  collections: RoutedCollection[];
  look: WebsiteLook;
  logo: DeliveredAsset | null;
  seoEnabled: boolean;
  /** The Online shop plugin is on, so the website has shop pages. */
  shopEnabled: boolean;
  seoDefaults: SeoDefaults;
  /** The site's public address, for canonical links and the sitemap. Null when unknown. */
  siteAddress: string | null;
  /** The site's path prefix ("/fr"), or "" when it has the whole domain. */
  pathPrefix: string;
  stylesheet: { css: string; path: string };
  /** The site's own fonts, for the builder's font list. */
  fonts: SiteFontChoice[];
  /** Stylesheets font services ask to be linked to (an Adobe Fonts project's). */
  fontStylesheetUrls: string[];
  /** Page transitions, cursor and intro; drawn per page by siteEffectsHead. */
  effectSettings: SiteEffectSettings;
  /** Whether Code elements may run scripts: applied each time a design is drawn. */
  scriptRule: CustomScriptRule;
  /** The site's design variables and shared styles, made in the page builder. */
  design: SiteDesign;
  /**
   * The cookie notice, when the site shows one (see src/cookie-notice): what every page
   * tells its script, and the privacy page's address in each language. Null otherwise.
   */
  cookieNotice: SiteCookieNotice | null;
}

export interface SiteCookieNotice {
  page: Omit<CookieNoticePage, "privacyUrl">;
  privacyUrls: Readonly<Record<string, string>>;
}

/** The address the stylesheet is served at changes with its contents, so it caches forever. */
export const STYLESHEET_FOLDER = "/_lintel";

export async function loadSiteContext(
  database: DatabaseOrTransaction,
  options: {
    templates: readonly SiteTemplate[];
    assetLookup: AssetLookup;
    builtInSiteUrl: string | null;
    site: Site;
  },
): Promise<SiteContext> {
  const { site } = options;
  const effects = readSiteEffects(database, site);
  const websiteFonts = readWebsiteFonts(database, site, options.assetLookup);
  const scriptRule = readSetting(database, "builderCustomScripts");
  const design = await readSiteDesign(database, site);
  const noticeSettings = readCookieNoticeSettings(database);
  const [locales, collections, look, seoEnabled, seoDefaults, siteAddress, plugins] =
    await Promise.all([
      listLocales(database, site),
      listRoutedCollections(database, site),
      readWebsiteLook(database, options.templates),
      isSeoPluginEnabled(database),
      readSeoDefaults(database),
      readAddressForSite(database, site).then((address) => address || options.builtInSiteUrl),
      findEnabledPluginIds(database),
    ]);
  const logo = look.logoAssetId
    ? ((await options.assetLookup.findAssetsByIds([look.logoAssetId])).get(look.logoAssetId) ??
      null)
    : null;
  // Pages designed in the builder need a few element defaults; the canvas draws with this same file.
  // Site fonts follow the theme, so the theme's heading and body choices can name them. The
  // site's own design variables come last, beside the theme's tokens they add to.
  const { fonts, stylesheetUrls } = await websiteFonts;
  const cookieNotice = await loadCookieNotice(database, {
    site,
    settings: await noticeSettings,
    scriptRule: await scriptRule,
    enabledPlugins: plugins,
    fontStylesheets: stylesheetUrls,
    locales: locales.locales.map(({ code }) => code),
    localise: (url, locale) =>
      localiseUrl(url, locale, {
        defaultLocale: locales.defaultLocale,
        pathPrefix: site.pathPrefix,
      }),
  });
  // Adobe Fonts' stylesheet waits for visitors to allow it; the theme's fonts show till then.
  const fontsWait = (cookieNotice?.page.fontStylesheets.length ?? 0) > 0;
  const css = [
    siteStylesheet(look.theme, look.template),
    websiteFontsStylesheet(fonts, look),
    designBaseStylesheet,
    designVariablesStylesheet(design.variables),
    compileTagStyles(design.tagStyles),
  ]
    .filter(Boolean)
    .join("\n\n");
  const fingerprint = createHash("sha256").update(css).digest("hex").slice(0, 12);
  return {
    defaultLocale: locales.defaultLocale,
    locales: locales.locales.map(({ code, name }) => ({ code, name })),
    collections,
    look,
    logo,
    seoEnabled,
    shopEnabled: plugins.includes("commerce"),
    seoDefaults,
    siteAddress,
    pathPrefix: site.pathPrefix,
    stylesheet: { css, path: `${STYLESHEET_FOLDER}/site-${fingerprint}.css` },
    fonts: fonts.map(({ family, category, source }) => ({ family, category, source })),
    fontStylesheetUrls: fontsWait ? [] : stylesheetUrls,
    effectSettings: await effects,
    scriptRule: await scriptRule,
    design,
    cookieNotice,
  };
}

/** The site's cookie notice, or null when its settings or its services say there is none. */
async function loadCookieNotice(
  database: DatabaseOrTransaction,
  options: {
    site: Site;
    settings: Awaited<ReturnType<typeof readCookieNoticeSettings>>;
    scriptRule: CustomScriptRule;
    enabledPlugins: readonly string[];
    fontStylesheets: readonly string[];
    locales: readonly string[];
    localise: (url: string, locale: string) => string;
  },
): Promise<SiteCookieNotice | null> {
  const { settings, site } = options;
  if (settings.mode === "off") return null;
  const services = await findSiteConsentServices(database, site, {
    scriptRule: options.scriptRule,
    usesAdobeFonts: options.fontStylesheets.length > 0,
    enabledPlugins: options.enabledPlugins,
  });
  if (!isCookieNoticeShown(settings, services)) return null;
  const waitingFonts = services.some((service) => service.id === adobeFontsService.id)
    ? options.fontStylesheets
    : [];
  return {
    page: buildCookieNoticePage(settings, services, site, waitingFonts),
    privacyUrls: await findPrivacyPageUrls(
      database,
      settings.privacyPageId,
      options.locales,
      options.localise,
    ),
  };
}

/** Collections whose entries have pages, with the taxonomies their posts are filed under. */
async function listRoutedCollections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<RoutedCollection[]> {
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  const routed = collections.filter(
    (collection) => collection.routePattern !== null && isCollectionOnSite(collection, site),
  );
  return Promise.all(
    routed.map(async (collection) => {
      const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
      const taxonomyHandles = blueprint.fields.flatMap((field) =>
        field.type === "terms" && typeof field.options.taxonomy === "string"
          ? [field.options.taxonomy]
          : [],
      );
      return {
        handle: collection.handle,
        name: collection.name,
        structure: collection.structure,
        routePattern: collection.routePattern ?? "/{slug}",
        taxonomyHandles: [...new Set(taxonomyHandles)],
        choiceLabels: choiceLabelsOf(blueprint.fields),
      };
    }),
  );
}
