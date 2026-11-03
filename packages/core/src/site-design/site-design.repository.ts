import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";

/**
 * Database reads and writes for a site's design system: one row in the settings table per
 * site, `siteDesign:<site id>`. Before each site had its own there was one `siteDesign` row
 * for them all; a site that has not saved its own yet still reads that one.
 */

const sharedSettingKey = "siteDesign";

function settingKey(siteId: string): string {
  return `${sharedSettingKey}:${siteId}`;
}

/** The site's own saved design, else the one all sites shared before, else undefined. */
export async function findStoredSiteDesign(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return (
    (await findSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId))) ??
    findSettingValue(database, DEFAULT_TENANT_ID, sharedSettingKey)
  );
}

export function saveStoredSiteDesign(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}
