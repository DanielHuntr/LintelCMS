import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";

/**
 * The website's public address (Settings → Site), such as "https://www.example.com", or ""
 * while no site is connected. "View page", the sitemap and canonical addresses use it.
 */
export function readSiteAddress(database: DatabaseOrTransaction): Promise<string> {
  return readSetting(database, "siteAddress");
}

/** Saves an address already tidied to its origin by the request schema. */
export async function saveSiteAddress(
  database: DatabaseOrTransaction,
  siteAddress: string,
): Promise<string> {
  await writeSetting(database, "siteAddress", siteAddress);
  return siteAddress;
}
