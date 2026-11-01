import type { DatabaseOrTransaction } from "../database/client.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";

/**
 * Whether "SEO tools" is on, for SEO code outside the plugin's routes (which are guarded
 * for it): GraphQL's redirects, and suggesting redirects when pages move.
 */
export function isSeoPluginEnabled(database: DatabaseOrTransaction): Promise<boolean> {
  return isPluginEnabled(database, "seo");
}
