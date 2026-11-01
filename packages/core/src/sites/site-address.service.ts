import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";

/**
 * The website's public address as typed in Settings → Your website, such as
 * "https://www.example.com", or "" while none has been typed. This is the one place the
 * address is kept: the website, "View page", the sitemap and canonical addresses all use it.
 */
export function readSiteAddress(database: DatabaseOrTransaction): Promise<string> {
  return readSetting(database, "siteAddress");
}

/**
 * Where the website is actually reached: the typed address, or else the built-in website's
 * own address (when this install serves one, see src/website). Null when there is neither.
 */
export async function readEffectiveSiteAddress(
  database: DatabaseOrTransaction,
  builtInSiteUrl: string | null,
): Promise<string | null> {
  return (await readSiteAddress(database)) || builtInSiteUrl || null;
}

/** Saves an address already tidied to its origin by the request schema. */
export async function saveSiteAddress(
  database: DatabaseOrTransaction,
  siteAddress: string,
): Promise<string> {
  await writeSetting(database, "siteAddress", siteAddress);
  return siteAddress;
}
