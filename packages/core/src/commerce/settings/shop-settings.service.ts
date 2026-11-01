import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { findOrCreateShopSettingsRow, updateShopSettingsRow } from "./shop-settings.repository.js";
import type { ShopSettings, UpdateShopSettingsRequest } from "./shop-settings.schema.js";
import type { ShopSettingsRow } from "./shop-settings.table.js";

/** The shop's name, support address and order numbering. Taxes and payments have their own. */

export async function readShopSettingsRow(
  database: DatabaseOrTransaction,
): Promise<ShopSettingsRow> {
  return findOrCreateShopSettingsRow(database, DEFAULT_TENANT_ID);
}

export async function readShopSettings(database: DatabaseOrTransaction): Promise<ShopSettings> {
  const row = await readShopSettingsRow(database);
  return {
    shopName: row.shopName,
    supportEmail: row.supportEmail,
    orderNumberPrefix: row.orderNumberPrefix,
    nextOrderNumber: row.nextOrderNumber,
  };
}

export async function updateShopSettings(
  database: DatabaseOrTransaction,
  changes: UpdateShopSettingsRequest,
): Promise<ShopSettings> {
  await updateShopSettingsRow(database, DEFAULT_TENANT_ID, changes);
  return readShopSettings(database);
}
