import { eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { type ShopSettingsRow, shopSettingsTable } from "./shop-settings.table.js";

/** Database reads and writes for the shop's one settings row. */

export type ShopSettingsChanges = Partial<
  Omit<ShopSettingsRow, "tenantId" | "nextOrderNumber" | "createdAt" | "updatedAt">
>;

/** The settings row, made with the defaults the first time anything asks for it. */
export async function findOrCreateShopSettingsRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ShopSettingsRow> {
  await database.insert(shopSettingsTable).values({ tenantId }).onConflictDoNothing();
  const [row] = await database
    .select()
    .from(shopSettingsTable)
    .where(eq(shopSettingsTable.tenantId, tenantId))
    .limit(1);
  if (!row) {
    throw new Error("The shop settings could not be read");
  }
  return row;
}

export async function updateShopSettingsRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  changes: ShopSettingsChanges,
): Promise<void> {
  await findOrCreateShopSettingsRow(database, tenantId);
  // Nothing to change isn't an error: the database refuses an update with nothing to set
  // (LINTEL-FUNC-010).
  if (Object.values(changes).every((value) => value === undefined)) return;
  await database
    .update(shopSettingsTable)
    .set(changes)
    .where(eq(shopSettingsTable.tenantId, tenantId));
}

/**
 * Takes the next order number. One UPDATE both reads and moves the counter on, so two
 * orders completing at the same moment can never get the same number.
 */
export async function takeNextOrderNumber(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<{ number: number; prefix: string }> {
  await findOrCreateShopSettingsRow(database, tenantId);
  const [taken] = await database
    .update(shopSettingsTable)
    .set({ nextOrderNumber: sql`${shopSettingsTable.nextOrderNumber} + 1` })
    .where(eq(shopSettingsTable.tenantId, tenantId))
    .returning({
      number: sql<number>`${shopSettingsTable.nextOrderNumber} - 1`,
      prefix: shopSettingsTable.orderNumberPrefix,
    });
  if (!taken) {
    throw new Error("Taking an order number returned nothing");
  }
  return { number: Number(taken.number), prefix: taken.prefix };
}
