import type { MenuItem, SiteChrome } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { deliverAllGlobalSets } from "../globals/globals-delivery.service.js";
import { mainMenu } from "../navigation/default-navigation.js";
import { deliverNavigation } from "../navigation/navigation-delivery.service.js";
import { NavigationNotFoundError } from "../navigation/navigation.errors.js";
import type { DeliveredNavigationItem } from "../navigation/navigation.schema.js";
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

/** An address on the site in a language: "/about" becomes "/fr/about" in French. */
export function localiseUrl(url: string, locale: string, defaultLocale: string): string {
  return url.startsWith("/") && !url.startsWith("//")
    ? localisedPath(siteUrlFor(url), locale, defaultLocale)
    : url;
}

export async function loadSiteChrome(
  database: DatabaseOrTransaction,
  context: SiteContext,
  locale: string,
  assetLookup: AssetLookup,
  site?: Site,
): Promise<SiteChrome> {
  const [{ globals }, menuItems] = await Promise.all([
    deliverAllGlobalSets(database, locale, assetLookup, site),
    loadMainMenu(database, locale, site),
  ]);
  const settings = globals.site_settings ?? {};
  const socialLinks = Array.isArray(settings.social_links)
    ? settings.social_links.filter(
        (link): link is string => typeof link === "string" && link !== "",
      )
    : [];
  const localise = (url: string) => localiseUrl(url, locale, context.defaultLocale);
  return {
    siteName: readText(settings.site_name) || context.seoDefaults.siteName || "My website",
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

/** A site may have deleted its main menu; then the header shows the name alone. */
async function loadMainMenu(
  database: DatabaseOrTransaction,
  locale: string,
  site?: Site,
): Promise<DeliveredNavigationItem[]> {
  try {
    return (await deliverNavigation(database, mainMenu.handle, locale, site)).items;
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
