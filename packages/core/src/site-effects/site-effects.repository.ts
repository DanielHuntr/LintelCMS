import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";

/**
 * Database reads and writes for a site's effects: one row in the settings table per site,
 * `siteEffects:<site id>`. Before each site had its own there was one `siteEffects` row for
 * them all; a site that has not saved its own yet still reads that one.
 */

const sharedSettingKey = "siteEffects";

function settingKey(siteId: string): string {
  return `${sharedSettingKey}:${siteId}`;
}

/** The site's own saved effects, else the ones all sites shared before, else undefined. */
export async function findStoredSiteEffects(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return (
    (await findSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId))) ??
    findSettingValue(database, DEFAULT_TENANT_ID, sharedSettingKey)
  );
}

export function saveStoredSiteEffects(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}
