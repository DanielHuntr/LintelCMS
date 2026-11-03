import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import { isDefaultSite } from "./sites.service.js";
import type { Site } from "./sites.table.js";

/**
 * The website's public address as typed in Settings → Your website, such as
 * "https://www.example.com", or "" while none has been typed. This is the one place the
 * address is kept: the website, "View page", the sitemap and canonical addresses all use it.
 */
export function readSiteAddress(database: DatabaseOrTransaction): Promise<string> {
  return readSetting(database, "siteAddress");
}

/**
 * One site's public address: its own (Build → Websites and domains), or for the default site the one
 * typed in Settings → Your website. "" when neither is known.
 */
export async function readAddressForSite(
  database: DatabaseOrTransaction,
  site: Site | undefined,
): Promise<string> {
  if (site?.siteUrl) return site.siteUrl;
  return site === undefined || isDefaultSite(site) ? readSiteAddress(database) : "";
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
