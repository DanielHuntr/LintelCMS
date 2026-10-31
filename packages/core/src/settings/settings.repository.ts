import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { settingsTable } from "./settings.table.js";

/** Database reads and writes for settings, nothing else. Values are checked by the service. */

export async function findSettingValue(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
): Promise<unknown> {
  const [setting] = await database
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(and(eq(settingsTable.tenantId, tenantId), eq(settingsTable.key, key)))
    .limit(1);
  return setting?.value;
}

export async function upsertSettingValue(
  database: DatabaseOrTransaction,
  tenantId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await database
    .insert(settingsTable)
    .values({ tenantId, key, value })
    .onConflictDoUpdate({
      target: [settingsTable.tenantId, settingsTable.key],
      set: { value, updatedAt: new Date() },
    });
}
