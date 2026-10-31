/**
 * Every first-party plugin, in one visible list (no discovery by file names).
 *
 * For now a plugin is only a name the admin can switch on and off, so new users aren't
 * shown every feature at once. This list is where the plugin system will grow from:
 * later each entry will also register its own routes, tables and admin screens.
 */
export interface PluginDefinition {
  id: string;
  name: string;
  /** One plain sentence, shown on the "What are you building?" setup step. */
  description: string;
  /** Admin paths that only appear while the plugin is on. */
  adminSections: string[];
}

export const pluginRegistry = [
  {
    id: "blog",
    name: "Blog",
    description: "Posts, categories and tags.",
    adminSections: [],
  },
  {
    id: "commerce",
    name: "Online shop",
    description: "Products, orders and payments.",
    adminSections: ["/commerce"],
  },
  {
    id: "forms",
    name: "Forms",
    description: "Contact forms and submissions.",
    adminSections: ["/forms"],
  },
  {
    id: "seo",
    name: "SEO tools",
    description: "Page titles, sitemaps and redirects.",
    adminSections: [],
  },
] as const satisfies readonly PluginDefinition[];

export type PluginId = (typeof pluginRegistry)[number]["id"];

export function isPluginId(id: string): id is PluginId {
  return pluginRegistry.some((plugin) => plugin.id === id);
}
