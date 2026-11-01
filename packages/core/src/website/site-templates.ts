import { builtInTemplates, type SiteTemplate } from "@lintel/site-components";

/**
 * The templates Settings, Site offers, in one visible list. The built-in ones come from
 * @lintel/site-components; an install adds its own through `buildServer`'s
 * `website.templates` (see "How Lintel renders sites" in the docs).
 */
export function listSiteTemplates(extraTemplates: readonly SiteTemplate[] = []): SiteTemplate[] {
  const extraIds = new Set(extraTemplates.map((template) => template.id));
  return [...builtInTemplates.filter((template) => !extraIds.has(template.id)), ...extraTemplates];
}
