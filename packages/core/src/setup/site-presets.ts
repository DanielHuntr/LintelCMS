import type { PluginId } from "../plugins/plugins.registry.js";
import type { SiteType } from "../settings/settings.schema.js";

/**
 * The plugins each kind of site starts with. Forms and SEO tools are useful to every site, so
 * they are always on; the kind of site adds its own extras, so a blog never shows an empty
 * shop. Everything can be switched on or off later in Build → Features.
 *
 * The admin imports this file (`@lintel/core/site-presets`) to show the same choice, so it
 * must not import server code: the registry's plugin definitions bring in routes and Node
 * modules. It keeps its own list of the built-in features instead, and a test checks that
 * list matches the registry.
 */

/** The built-in features, in registry order, with the names Build → Features shows. */
export const builtInFeatures: readonly { id: PluginId; name: string }[] = [
  { id: "blog", name: "Blog" },
  { id: "commerce", name: "Online shop" },
  { id: "forms", name: "Forms" },
  { id: "automations", name: "Automations" },
  { id: "seo", name: "SEO tools" },
  { id: "free-photos", name: "Free photos" },
  { id: "drafts", name: "Page drafting" },
  { id: "experiments", name: "A/B testing" },
];
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
  return builtInFeatures.map((feature) => feature.id).filter((id) => chosen.has(id));
}

/** The same set with each feature's name, for showing before anything is saved. */
export function featuresForSiteType(siteType: SiteType): { id: PluginId; name: string }[] {
  const chosen = pluginsForSiteType(siteType);
  return builtInFeatures
    .filter((feature) => chosen.includes(feature.id))
    .map((feature) => ({ id: feature.id, name: feature.name }));
}
