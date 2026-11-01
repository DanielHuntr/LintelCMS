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
  /**
   * What the plugin lets people do, for the role editor. Each appears there, in plain
   * words, while the plugin is switched on (see src/roles/permission-catalog.ts).
   */
  permissions: PluginPermission[];
}

export interface PluginPermission {
  permission: `${string}:${string}`;
  name: string;
  description: string;
}

export const pluginRegistry = [
  {
    id: "blog",
    name: "Blog",
    description: "Posts, categories and tags.",
    adminSections: [],
    permissions: [],
  },
  {
    id: "commerce",
    name: "Online shop",
    description: "Products, orders and payments.",
    adminSections: ["/commerce"],
    permissions: [
      {
        permission: "commerce:read",
        name: "See the shop",
        description: "Products, orders and customers.",
      },
      {
        permission: "commerce:update",
        name: "Run the shop",
        description: "Change products and prices, and handle orders.",
      },
      {
        permission: "orders:refund",
        name: "Refund orders",
        description: "Give money back to customers.",
      },
    ],
  },
  {
    id: "forms",
    name: "Forms",
    description: "Contact forms and submissions.",
    adminSections: ["/forms"],
    permissions: [
      { permission: "forms:read", name: "See forms", description: "Forms and what people sent." },
      {
        permission: "forms:update",
        name: "Change forms",
        description: "Build forms, and delete submissions.",
      },
    ],
  },
  {
    id: "seo",
    name: "SEO tools",
    description: "Page titles, sitemaps and redirects.",
    adminSections: [],
    // Uses the content and settings permissions everyone already has.
    permissions: [],
  },
] as const satisfies readonly PluginDefinition[];

export type PluginId = (typeof pluginRegistry)[number]["id"];

export function isPluginId(id: string): id is PluginId {
  return pluginRegistry.some((plugin) => plugin.id === id);
}
