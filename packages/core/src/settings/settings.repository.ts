import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { settingsTable as settingsDefinition } from "./settings.table.js";
import { insertIfNewReturning, upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for settings, nothing else. Values are checked by the service. */

export async function findSettingValue(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
): Promise<unknown> {
  const settingsTable = tableFor(database, settingsDefinition);
  const [setting] = await database
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(and(eq(settingsTable.tenantId, tenantId), eq(settingsTable.key, key)))
    .limit(1);
  return setting?.value;
}

/** When a setting was last saved, or null when it has never been. */
export async function findSettingUpdatedAt(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
): Promise<Date | null> {
  const settingsTable = tableFor(database, settingsDefinition);
  const [setting] = await database
    .select({ updatedAt: settingsTable.updatedAt })
    .from(settingsTable)
    .where(and(eq(settingsTable.tenantId, tenantId), eq(settingsTable.key, key)))
    .limit(1);
  return setting?.updatedAt ?? null;
}

/** Saves a value only if the key has none yet. Returns whether this call saved it. */
export async function insertSettingValueIfMissing(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
  value: unknown,
): Promise<boolean> {
  const settingsTable = tableFor(database, settingsDefinition);
  const inserted = await insertIfNewReturning(
    database,
    settingsTable,
    { tenantId, key, value },
    { target: [settingsTable.tenantId, settingsTable.key] },
    { id: settingsTable.id },
  );
  return inserted.length > 0;
}

/** Removes a setting, so it reads as never saved. */
export async function deleteSettingValue(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
): Promise<void> {
  const settingsTable = tableFor(database, settingsDefinition);
  await database
    .delete(settingsTable)
    .where(and(eq(settingsTable.tenantId, tenantId), eq(settingsTable.key, key)));
}

export async function upsertSettingValue(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const settingsTable = tableFor(database, settingsDefinition);
  await upsert(
    database,
    settingsTable,
    { tenantId, key, value },
    {
      target: [settingsTable.tenantId, settingsTable.key],
      set: { value, updatedAt: new Date() },
    },
  );
}
