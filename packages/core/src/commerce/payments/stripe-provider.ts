import { startEmbeddedPayment, startHostedPayment } from "../checkouts/stripe-payment.js";
import type { ShopContext } from "../commerce.context.js";
import type { RefundStatus } from "../orders/orders.table.js";
import { readShopSettingsRow } from "../settings/shop-settings.service.js";
import { type PaymentProvider, ProviderRequestError } from "./payment-provider.js";
import {
  cancelStripePaymentIntent,
  createStripeRefund,
  expireStripeCheckoutSession,
} from "./stripe-api.js";
import { StripeRequestError } from "./stripe-client.js";
import { toStripeAmount } from "../money/stripe-amounts.js";

/**
 * Stripe behind the PaymentProvider interface: its hosted Checkout page, or a
 * PaymentIntent for the Payment Element, as chosen in Shop → Settings → Payments.
 */
export function stripePaymentProvider(shop: ShopContext): PaymentProvider {
  return {
    id: "stripe",
    checkReady: async () => {
      await shop.stripe();
    },
    needsPages: async () => (await readShopSettingsRow(shop.database)).checkoutMode === "hosted",
    async startPayment(checkout, pages) {
      const stripe = await shop.stripe();
      const payment = await explain(() =>
        pages
          ? startHostedPayment(stripe, checkout, pages)
          : startEmbeddedPayment(stripe, checkout),
      );
      return {
        url: payment.url,
        clientSecret: payment.clientSecret,
        saved: {
          stripeCheckoutSessionId: payment.sessionId,
          stripePaymentIntentId: payment.paymentIntentId,
        },
      };
    },
    async closePayment(checkout) {
      if (!checkout.stripeCheckoutSessionId && !checkout.stripePaymentIntentId) return;
      const stripe = await shop.stripe();
      if (checkout.stripeCheckoutSessionId) {
        await expireStripeCheckoutSession(stripe, checkout.stripeCheckoutSessionId);
      } else if (checkout.stripePaymentIntentId) {
        await cancelStripePaymentIntent(stripe, checkout.stripePaymentIntentId);
      }
    },
    async refundPayment(order, refund) {
      if (!order.stripePaymentIntentId) {
        throw new Error("A paid Stripe order always has its payment intent");
      }
      const stripe = await shop.stripe();
      const paymentIntentId = order.stripePaymentIntentId;
      const made = await explain(() =>
        createStripeRefund(stripe, {
          paymentIntentId,
          amount: toStripeAmount(refund.amount, order.currency),
          orderId: order.id,
          refundId: refund.id,
        }),
      );
      return { reference: made.id, status: stripeRefundStatus(made.status) };
    },
  };
}

export function stripeRefundStatus(status: string | null | undefined): RefundStatus {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "pending";
}

async function explain<Result>(call: () => Promise<Result>): Promise<Result> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof StripeRequestError) {
      throw new ProviderRequestError(error.message, error.status);
    }
    throw error;
  }
}
