import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { PageSettings } from "./pages.schema.js";

/** The page builder's site settings; they are stored with the other settings. */
export async function readPageSettings(database: DatabaseOrTransaction): Promise<PageSettings> {
  return { customScripts: await readSetting(database, "builderCustomScripts") };
}

export async function updatePageSettings(
  database: DatabaseOrTransaction,
  settings: PageSettings,
): Promise<PageSettings> {
  await writeSetting(database, "builderCustomScripts", settings.customScripts);
  return readPageSettings(database);
}
