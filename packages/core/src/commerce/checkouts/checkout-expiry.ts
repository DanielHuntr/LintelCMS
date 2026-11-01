import type { DatabaseOrTransaction } from "../../database/client.js";
import type { ShopContext } from "../commerce.context.js";
import { releaseStock } from "../inventory/inventory.service.js";
import { releaseExpiredReservationRows } from "../inventory/inventory.repository.js";
import { cancelStripePaymentIntent, expireStripeCheckoutSession } from "../payments/stripe-api.js";
import { expireOpenCheckoutRow, listExpiredOpenCheckoutRows } from "./checkouts.repository.js";

/**
 * Checkouts nobody paid for. Their stock goes back on sale, and their Stripe payment is
 * closed so it can't be paid later. A payment that still arrives (they can cross in the
 * post) is honoured anyway: see orders/order-placement.service.ts.
 */

/** Marks an open checkout expired and releases its stock. Safe to call twice. */
export async function abandonCheckout(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<void> {
  await expireOpenCheckoutRow(database, checkoutId);
  await releaseStock(database, checkoutId);
}

/** Closes the Stripe side. Failures are logged: the checkout is already closed on ours. */
export async function closeStripePayment(
  shop: ShopContext,
  checkout: {
    id: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId?: string | null;
  },
): Promise<void> {
  if (!checkout.stripeCheckoutSessionId && !checkout.stripePaymentIntentId) return;
  try {
    const stripe = await shop.stripe();
    if (checkout.stripeCheckoutSessionId) {
      await expireStripeCheckoutSession(stripe, checkout.stripeCheckoutSessionId);
    } else if (checkout.stripePaymentIntentId) {
      await cancelStripePaymentIntent(stripe, checkout.stripePaymentIntentId);
    }
  } catch (error) {
    shop.log.warn(
      `Closing the Stripe payment for checkout ${checkout.id} didn't work: ${error instanceof Error ? error.message : String(error)}`,
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
      // Hosted pages expire on Stripe's side at the same moment; only payment intents need closing.
      if (!checkout.stripeCheckoutSessionId) {
        await closeStripePayment(shop, checkout);
      }
    }
  }
  return expired.length;
}
