import { ensurePagesCollection } from "../collections/default-collections.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import type { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import type { PluginList } from "../plugins/plugins.schema.js";
import { writeSetting } from "../settings/settings.service.js";
import type { SiteChoices } from "./setup.schema.js";
import { pluginsForSiteType } from "./site-presets.js";

/**
 * The "Site name" and "What you're building" answers: saves the name and kind of site, and
 * switches on the features for that kind (see site-presets.ts). Part of finishing setup.
 *
 * Every site gets a Pages collection, a "Site settings" global set and an empty main menu
 * here, and switching on the blog plugin adds Blog posts with Categories and Tags. All are
 * only created if missing, so running this again changes no content.
 */
export async function saveSiteChoices(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  choices: SiteChoices,
): Promise<PluginList> {
  await writeSetting(database, "siteName", choices.siteName);
  await writeSetting(database, "siteType", choices.siteType);
  await writeSetting(database, "siteSetupCompleted", true);
  await ensurePagesCollection(database);
  await ensureSiteSettings(database);
  await ensureMainMenu(database);
  return setEnabledPlugins(database, catalogue, pluginsForSiteType(choices.siteType));
}
