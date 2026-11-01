import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  findSettingValue,
  insertSettingValueIfMissing,
  upsertSettingValue,
} from "./settings.repository.js";
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

/**
 * Reads a setting, saving `create()` first if it has no value yet. When two requests race
 * to create it, the first one saved wins and both get that value, so something like a
 * signing secret is never replaced behind the back of whoever made it first.
 */
export async function readOrCreateSetting<Key extends SettingKey>(
  database: DatabaseOrTransaction,
  key: Key,
  create: () => NonNullable<SettingValue<Key>>,
): Promise<NonNullable<SettingValue<Key>>> {
  const existing = await readSetting(database, key);
  if (existing !== null && existing !== undefined) {
    return existing as NonNullable<SettingValue<Key>>;
  }
  const value = settingSchemas[key].parse(create());
  await insertSettingValueIfMissing(database, DEFAULT_TENANT_ID, key, value);
  const saved = await readSetting(database, key);
  if (saved === null || saved === undefined) {
    throw new Error(`The setting "${key}" could not be saved.`);
  }
  return saved as NonNullable<SettingValue<Key>>;
}

export async function writeSetting<Key extends SettingKey>(
  database: DatabaseOrTransaction,
  key: Key,
  value: SettingValue<Key>,
): Promise<void> {
  await upsertSettingValue(database, DEFAULT_TENANT_ID, key, settingSchemas[key].parse(value));
}
