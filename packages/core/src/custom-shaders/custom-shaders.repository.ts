import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";

/** Database reads and writes: one `customShaders:<site id>` row per site in the settings table. */

const settingKey = (siteId: string) => `customShaders:${siteId}`;

export function findStoredShaders(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId));
}

export function saveStoredShaders(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}
