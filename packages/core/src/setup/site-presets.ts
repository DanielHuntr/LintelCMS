import { pluginRegistry, type PluginId } from "../plugins/plugins.registry.js";
import type { SiteType } from "../settings/settings.schema.js";

/**
 * The plugins each kind of site starts with. Forms and SEO tools are useful to every site, so
 * they are always on; the kind of site adds its own extras, so a blog never shows an empty
 * shop. Everything can be switched on or off later in Settings → Features.
 *
 * The admin imports this file (`@lintel/core/site-presets`) to show the same choice.
 */
export const pluginsForEverySite: readonly PluginId[] = ["forms", "seo"];

const extrasBySiteType: Record<SiteType, readonly PluginId[]> = {
  business: [],
  blog: ["blog"],
  shop: ["commerce"],
  portfolio: [],
  blank: [],
};

/** In registry order, so the same choice is always listed the same way. */
export function pluginsForSiteType(siteType: SiteType): PluginId[] {
  const chosen = new Set<PluginId>([...pluginsForEverySite, ...extrasBySiteType[siteType]]);
  return pluginRegistry.map((plugin) => plugin.id).filter((id) => chosen.has(id));
}

/** The same set with each feature's name, for showing before anything is saved. */
export function featuresForSiteType(siteType: SiteType): { id: PluginId; name: string }[] {
  const chosen = pluginsForSiteType(siteType);
  return pluginRegistry
    .filter((plugin) => chosen.includes(plugin.id))
    .map((plugin) => ({ id: plugin.id, name: plugin.name }));
}
