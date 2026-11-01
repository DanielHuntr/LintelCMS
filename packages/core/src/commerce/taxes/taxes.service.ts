import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import { updateShopSettingsRow } from "../settings/shop-settings.repository.js";
import { readShopSettingsRow } from "../settings/shop-settings.service.js";
import { ManualTaxProvider } from "./manual-tax-provider.js";
import { StripeTaxProvider } from "./stripe-tax-provider.js";
import type { TaxProvider } from "./tax-provider.js";
import type { TaxSettings, UpdateTaxSettingsRequest } from "./taxes.schema.js";

/** Which tax provider the shop uses, and the manual rates. */

export async function readTaxSettings(shop: ShopContext): Promise<TaxSettings> {
  const settings = await readShopSettingsRow(shop.database);
  const keys = await shop.stripeKeys();
  return {
    taxCalculation: settings.taxCalculation,
    taxShipping: settings.taxShipping,
    manualTaxRates: settings.manualTaxRates,
    effectiveCalculation:
      settings.taxCalculation === "stripe" && keys.secretKey ? "stripe" : "manual",
  };
}

export async function updateTaxSettings(
  shop: ShopContext,
  changes: UpdateTaxSettingsRequest,
): Promise<TaxSettings> {
  await updateShopSettingsRow(shop.database, DEFAULT_TENANT_ID, changes);
  return readTaxSettings(shop);
}

/**
 * The provider for the shop's settings. Stripe Tax when it's chosen and Stripe is
 * connected; otherwise the manual rates, so a shop in development can check out before
 * anything is set up.
 */
export async function chooseTaxProvider(
  shop: ShopContext,
  database: DatabaseOrTransaction = shop.database,
): Promise<TaxProvider> {
  const settings = await readShopSettingsRow(database);
  const keys = await shop.stripeKeys();
  if (settings.taxCalculation === "stripe" && keys.secretKey) {
    return new StripeTaxProvider(shop.stripeWithKey(keys.secretKey.value));
  }
  return new ManualTaxProvider(settings.manualTaxRates, settings.taxShipping);
}
