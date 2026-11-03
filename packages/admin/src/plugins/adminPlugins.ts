import { installedAdminPlugins } from "virtual:lintel-plugins";
import { analyticsAdminPlugin } from "../analytics/analytics.adminPlugin.js";
import { commerceAdminPlugin } from "../commerce/commerce.adminPlugin.js";
import { experimentsAdminPlugin } from "../experiments/experiments.adminPlugin.js";
import { formsAdminPlugin } from "../forms/forms.adminPlugin.js";
import { pageDraftsAdminPlugin } from "../page-drafts/pageDrafts.adminPlugin.js";
import { seoAdminPlugin } from "../seo/seo.adminPlugin.js";
import { automationsAdminPlugin } from "../workflows/automations.adminPlugin.js";
import type { AdminPluginDefinition } from "./adminPlugin.js";

/**
 * The admin half of every plugin, in one visible list: the built-in ones, then those from
 * the packages in lintel.config.ts, in the same order as the server's list. The installed
 * ones come from a module the build writes from that file (see vite-plugin-lintel.ts), so
 * they are bundled and type-checked like the rest of the admin.
 *
 * The blog has nothing of its own here (yet), so it isn't listed.
 *
 * Add-ons installed into the site add theirs while the admin starts, before anything is
 * drawn (see src/addons/loadAddonAdminHalves.ts).
 */
const plugins: AdminPluginDefinition[] = [
  commerceAdminPlugin,
  formsAdminPlugin,
  automationsAdminPlugin,
  seoAdminPlugin,
  pageDraftsAdminPlugin,
  experimentsAdminPlugin,
  analyticsAdminPlugin,
  ...installedAdminPlugins,
];

export const adminPlugins: readonly AdminPluginDefinition[] = plugins;

/** Adds add-ons' admin halves, after the rest. Only called before the admin is drawn. */
export function addRuntimeAdminPlugins(addons: readonly AdminPluginDefinition[]): void {
  const known = new Set(plugins.map((plugin) => plugin.id));
  plugins.push(...addons.filter((addon) => !known.has(addon.id)));
}
