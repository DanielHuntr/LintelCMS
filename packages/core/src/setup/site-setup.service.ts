import { ensurePagesCollection } from "../collections/default-collections.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { ensureStarterSiteSections } from "../site-sections/site-sections.service.js";
import type { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import type { PluginList } from "../plugins/plugins.schema.js";
import { writeSetting } from "../settings/settings.service.js";
import { updateSiteRow } from "../sites/sites.repository.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import type { SiteChoices } from "./setup.schema.js";
import { pluginsForSiteType } from "./site-presets.js";

/**
 * The "Site name" and "What you're building" answers: saves the name and kind of site, and
 * switches on the features for that kind (see site-presets.ts). Part of finishing setup.
 *
 * Every site gets a Pages collection, a "Site settings" global set, an empty main menu and
 * a navigation and footer that follow it (see src/site-sections) here, and switching on the
 * blog plugin adds Blog posts with Categories and Tags. All are only created if missing, so
 * running this again changes no content.
 */
export async function saveSiteChoices(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  choices: SiteChoices,
): Promise<PluginList> {
  await writeSetting(database, "siteName", choices.siteName);
  // The first site takes the chosen name, so the admin never says "Default site".
  await updateSiteRow(database, (await findOrCreateDefaultSite(database)).id, {
    name: choices.siteName,
  });
  await writeSetting(database, "siteType", choices.siteType);
  await writeSetting(database, "siteSetupCompleted", true);
  await ensurePagesCollection(database);
  await ensureSiteSettings(database);
  await ensureMainMenu(database);
  await ensureStarterSiteSections(database);
  return setEnabledPlugins(database, catalogue, pluginsForSiteType(choices.siteType));
}
