import type { SiteType } from "./setup.api.js";

/**
 * The plugins each kind of site starts with. Lintel switches features on only when a site
 * needs them, so a blog never shows an empty shop. People can change these during setup
 * and any time later in Settings.
 */
const pluginsBySiteType: Record<SiteType, readonly string[]> = {
  business: ["forms", "seo"],
  blog: ["blog", "seo"],
  shop: ["commerce", "seo", "forms"],
  portfolio: ["forms", "seo"],
  blank: [],
};

export function pluginsForSiteType(siteType: SiteType): string[] {
  return [...pluginsBySiteType[siteType]];
}
