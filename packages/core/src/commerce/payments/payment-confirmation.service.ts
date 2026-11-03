import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import type { ShopContext } from "../commerce.context.js";
import { handleMollieWebhook } from "./mollie/mollie-webhook.service.js";
import { PAYMENT_PROVIDER_NAMES } from "./payment-provider.js";
import { confirmPayPalCheckout } from "./paypal/paypal-webhook.service.js";
import { confirmStripeCheckout } from "./stripe-webhook.service.js";

/**
 * When a shopper comes back from paying, asks the provider what happened instead of waiting
 * for its webhook, which can't reach a shop on someone's own computer. Nothing the shopper's
 * browser says is believed: the payment is fetched with the shop's own key, so this can't be
 * forged. It ends in the same `placeOrderForPayment` as the webhook, under the checkout's
 * lock, so whichever arrives second finds the order made and does nothing.
 *
 * The webhook stays the normal route for live shops, because a shopper may not come back.
 */

/** The confirmation page asks every two seconds; the provider needn't be asked as often. */
const ASK_AGAIN_AFTER_MS = 3000;
const REMEMBERED_CHECKOUTS = 1000;

const lastAsked = new WeakMap<ShopContext, Map<string, number>>();

/** Never throws: a provider that can't be reached just means asking again later. */
export async function confirmOpenCheckout(shop: ShopContext, checkout: CheckoutRow): Promise<void> {
  if (checkout.status !== "open" || !askedLongEnoughAgo(shop, checkout.id)) return;
  try {
    await askProvider(shop, checkout);
  } catch (error) {
    shop.log.warn(
      `Asking ${PAYMENT_PROVIDER_NAMES[checkout.paymentProvider]} about checkout ${checkout.id} didn't work: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function askedLongEnoughAgo(shop: ShopContext, checkoutId: string): boolean {
  const asked = lastAsked.get(shop) ?? new Map<string, number>();
  lastAsked.set(shop, asked);
  const now = shop.now().getTime();
  const previous = asked.get(checkoutId);
  if (previous !== undefined && now - previous < ASK_AGAIN_AFTER_MS) return false;
  if (asked.size >= REMEMBERED_CHECKOUTS) asked.clear();
  asked.set(checkoutId, now);
  return true;
}

async function askProvider(shop: ShopContext, checkout: CheckoutRow): Promise<void> {
  switch (checkout.paymentProvider) {
    case "stripe":
      return confirmStripeCheckout(shop, checkout);
    case "paypal":
      return confirmPayPalCheckout(shop, checkout);
    case "mollie":
      if (checkout.providerPaymentId) await handleMollieWebhook(shop, checkout.providerPaymentId);
      return;
    case "test":
      // Only the test payment page can finish a test checkout.
      return;
  }
}
