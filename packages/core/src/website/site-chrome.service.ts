import type { MenuItem, SiteChrome } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting } from "../settings/settings.service.js";
import { isDefaultSite } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { deliverAllGlobalSets } from "../globals/globals-delivery.service.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { deliverNavigation } from "../navigation/navigation-delivery.service.js";
import { NavigationNotFoundError } from "../navigation/navigation.errors.js";
import type { DeliveredNavigationItem } from "../navigation/navigation.schema.js";
import { addPathPrefix, removePathPrefix } from "../sites/site-addresses.js";
import { readImage, readText } from "./delivered-to-site.js";
import type { SiteContext } from "./site-context.service.js";
import { HOME_SLUG, localisedPath } from "./site-routing.js";

/**
 * The header and footer of every page in one language: the "Site settings" globals and
 * the main menu. Which menu item is the current page is marked per page, by `markCurrent`.
 */

/** Links to the home page's own entry ("/home") point at the site's root instead. */
export function siteUrlFor(url: string): string {
  return url === `/${HOME_SLUG}` ? "/" : url;
}

/**
 * An address on the site as visitors use it, in a language: "/about" becomes "/fr/about" in
 * French, and on a site served under a path prefix it keeps that prefix in front
 * ("/shop/fr/about"). Addresses from delivery already carry the prefix; this keeps one.
 */
export function localiseUrl(
  url: string,
  locale: string,
  site: Pick<SiteContext, "defaultLocale" | "pathPrefix">,
): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  const onSite = removePathPrefix(site.pathPrefix, url);
  const localised = localisedPath(siteUrlFor(onSite), locale, site.defaultLocale);
  return addPathPrefix(site.pathPrefix, localised) ?? localised;
}

export async function loadSiteChrome(
  database: DatabaseOrTransaction,
  context: SiteContext,
  locale: string,
  assetLookup: AssetLookup,
  site?: Site,
): Promise<SiteChrome> {
  const [{ globals }, menuItems, ownName] = await Promise.all([
    deliverAllGlobalSets(database, locale, assetLookup, site),
    loadMainMenu(database, locale, site),
    readOwnSiteName(database, site),
  ]);
  const settings = globals.site_settings ?? {};
  const socialLinks = Array.isArray(settings.social_links)
    ? settings.social_links.filter(
        (link): link is string => typeof link === "string" && link !== "",
      )
    : [];
  const localise = (url: string) => localiseUrl(url, locale, context);
  return {
    siteName:
      readText(settings.site_name) || ownName || context.seoDefaults.siteName || "My website",
    logo: context.logo ? readImage(context.logo) : null,
    homeUrl: localise("/"),
    menu: menuItems.map((item) => toMenuItem(item, localise)),
    footerText: readText(settings.footer_text),
    contactEmail: readText(settings.contact_email),
    socialLinks,
    languages: [],
    locale,
  };
}

/**
 * The site's name when Site settings doesn't give one: the name from setup for the default
 * site, the name in Settings → Sites for the others.
 */
async function readOwnSiteName(
  database: DatabaseOrTransaction,
  site: Site | undefined,
): Promise<string | null> {
  if (site && !isDefaultSite(site)) return site.name;
  return readSetting(database, "siteName");
}

/**
 * Another of the site's menus, for a header or menu that chose it ("Which menu" in the
 * builder), ready for the page: in the language shown, with the site's prefix.
 */
export async function loadOtherMenu(
  database: DatabaseOrTransaction,
  handle: string,
  context: SiteContext,
  locale: string,
  site?: Site,
): Promise<MenuItem[]> {
  const items = await loadMainMenu(database, locale, site, handle);
  return items.map((item) => toMenuItem(item, (url) => localiseUrl(url, locale, context)));
}

/** A site may have deleted its main menu; then the header shows the name alone. */
async function loadMainMenu(
  database: DatabaseOrTransaction,
  locale: string,
  site?: Site,
  handle: string = mainMenu.handle,
): Promise<DeliveredNavigationItem[]> {
  try {
    return (await deliverNavigation(database, handle, locale, site)).items;
  } catch (error) {
    if (error instanceof NavigationNotFoundError) {
      return [];
    }
    throw error;
  }
}

function toMenuItem(item: DeliveredNavigationItem, localise: (url: string) => string): MenuItem {
  return {
    label: item.label,
    url: item.url === null ? null : localise(item.url),
    newTab: item.newTab,
    style: item.style,
    current: false,
    children: item.children.map((child) => toMenuItem(child, localise)),
  };
}

/** The menu with the item for this address marked as the current page. */
export function markCurrent(items: readonly MenuItem[], path: string): MenuItem[] {
  return items.map((item) => ({
    ...item,
    current: item.url === path,
    children: markCurrent(item.children, path),
  }));
}
