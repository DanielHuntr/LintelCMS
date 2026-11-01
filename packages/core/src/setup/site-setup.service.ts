import { ensurePagesCollection } from "../collections/default-collections.js";
import type { Database } from "../database/client.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { writeSetting } from "../settings/settings.service.js";
import type { SiteSetupRequest, SiteSetupResponse } from "./setup.schema.js";

/**
 * The "What are you building?" step: saves the kind of site and switches on the plugins
 * picked for it. It can be run again later to change both; the plugins listed replace
 * the ones that were on.
 *
 * Every site gets a Pages collection, a "Site settings" global set and an empty main menu
 * here, and switching on the blog plugin adds Blog posts with Categories and Tags. All are
 * only created if missing, so running this again changes no content.
 */
export async function setUpSite(
  database: Database,
  request: SiteSetupRequest,
): Promise<SiteSetupResponse> {
  const pluginList = await database.transaction(async (transaction) => {
    await writeSetting(transaction, "siteType", request.siteType);
    await writeSetting(transaction, "siteSetupCompleted", true);
    await ensurePagesCollection(transaction);
    await ensureSiteSettings(transaction);
    await ensureMainMenu(transaction);
    return setEnabledPlugins(transaction, request.plugins);
  });

  return { siteType: request.siteType, plugins: pluginList.plugins };
}
