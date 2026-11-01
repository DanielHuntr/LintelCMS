import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";

/** Database reads and writes for site-wide effects: one row in the settings table. */

const settingKey = "siteEffects";

export function findStoredSiteEffects(database: DatabaseOrTransaction): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, settingKey);
}

export function saveStoredSiteEffects(
  database: DatabaseOrTransaction,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey, value);
}
