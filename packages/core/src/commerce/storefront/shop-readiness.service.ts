import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { isLocalAddress } from "../payments/local-address.js";
import { findMollieCredentials } from "../payments/mollie/mollie-provider.js";
import { marketPaymentProvider, type PaymentProviderId } from "../payments/payment-provider.js";
import { findPayPalCredentials } from "../payments/paypal/paypal-provider.js";
import { listRateRows, listZoneRows } from "../shipping/shipping.repository.js";

/**
 * Whether the shop can take an order: a market whose payment provider is connected, and a
 * delivery price somewhere. Until then the website shows products as "coming soon" rather
 * than letting shoppers fill a basket that checkout would turn away (LINTEL-UX-009).
 */
export async function isShopOpen(shop: ShopContext): Promise<boolean> {
  const zones = await listZoneRows(shop.database, DEFAULT_TENANT_ID);
  const rates = await listRateRows(
    shop.database,
    zones.map((zone) => zone.id),
  );
  if (rates.length === 0) return false;
  const markets = await listMarketRows(shop.database, DEFAULT_TENANT_ID);
  if (markets.length === 0) return false;
  const connected = await connectedProviders(shop);
  return markets.some((market) => connected.has(marketPaymentProvider(market)));
}

async function connectedProviders(shop: ShopContext): Promise<Set<PaymentProviderId>> {
  const connected = new Set<PaymentProviderId>();
  if ((await shop.stripeKeys()).secretKey) connected.add("stripe");
  const paypal = await findPayPalCredentials(shop);
  if (paypal && (paypal.webhookId !== null || isLocalAddress(shop.publicApiUrl))) {
    connected.add("paypal");
  }
  if (await findMollieCredentials(shop)) connected.add("mollie");
  return connected;
}
