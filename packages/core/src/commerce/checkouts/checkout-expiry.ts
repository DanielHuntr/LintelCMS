import type { DatabaseOrTransaction } from "../../database/client.js";
import type { ShopContext } from "../commerce.context.js";
import { releaseRedemptions } from "../discounts/discounts.repository.js";
import { releaseStock } from "../inventory/inventory.service.js";
import { releaseExpiredReservationRows } from "../inventory/inventory.repository.js";
import { PAYMENT_PROVIDER_NAMES } from "../payments/payment-provider.js";
import { paymentProviderFor } from "../payments/payment-providers.js";
import { expireOpenCheckoutRow, listExpiredOpenCheckoutRows } from "./checkouts.repository.js";
import type { CheckoutRow } from "./checkouts.table.js";

/**
 * Checkouts nobody paid for. Their stock goes back on sale, any discount use they held is
 * given back, and their payment is closed at the provider so it can't be paid later. A
 * payment that still arrives (they can cross in the post) is honoured anyway: see
 * orders/order-placement.service.ts.
 */

/** Marks an open checkout expired and releases its stock. Safe to call twice. */
export async function abandonCheckout(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<void> {
  await expireOpenCheckoutRow(database, checkoutId);
  await releaseStock(database, checkoutId);
  await releaseRedemptions(database, checkoutId);
}

/** Closes the provider's side. Failures are logged: the checkout is already closed on ours. */
export async function closeProviderPayment(
  shop: ShopContext,
  checkout: CheckoutRow,
): Promise<void> {
  try {
    await paymentProviderFor(shop, checkout.paymentProvider).closePayment(checkout);
  } catch (error) {
    shop.log.warn(
      `Closing the ${PAYMENT_PROVIDER_NAMES[checkout.paymentProvider]} payment for checkout ${checkout.id} didn't work: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** The every-minute job: lets go of stock whose time is up. Returns how many checkouts closed. */
export async function expireAbandonedCheckouts(shop: ShopContext): Promise<number> {
  const now = shop.now();
  await releaseExpiredReservationRows(shop.database, now);
  const expired = await listExpiredOpenCheckoutRows(shop.database, now);
  for (const checkout of expired) {
    if (await expireOpenCheckoutRow(shop.database, checkout.id)) {
      await releaseRedemptions(shop.database, checkout.id);
      // Stripe's hosted pages expire on Stripe's side at the same moment.
      if (!checkout.stripeCheckoutSessionId) {
        await closeProviderPayment(shop, checkout);
      }
    }
  }
  return expired.length;
}
