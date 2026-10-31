import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findSettingValue, upsertSettingValue } from "./settings.repository.js";
import {
  type SettingKey,
  type SettingValue,
  settingDefaults,
  settingSchemas,
} from "./settings.schema.js";

/**
 * Reads a setting, or its default when it has never been saved. A stored value that no
 * longer fits its schema (say, after a hand edit) also gives the default, rather than
 * breaking every page that reads it.
 */
export async function readSetting<Key extends SettingKey>(
  database: DatabaseOrTransaction,
  key: Key,
): Promise<SettingValue<Key>> {
  const stored = await findSettingValue(database, DEFAULT_TENANT_ID, key);
  const parsed = settingSchemas[key].safeParse(stored);
  return parsed.success ? (parsed.data as SettingValue<Key>) : settingDefaults[key];
}

export async function writeSetting<Key extends SettingKey>(
  database: DatabaseOrTransaction,
  key: Key,
  value: SettingValue<Key>,
): Promise<void> {
  await upsertSettingValue(database, DEFAULT_TENANT_ID, key, settingSchemas[key].parse(value));
}
