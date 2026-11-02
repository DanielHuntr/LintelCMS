import {
  createStripeCheckoutSession,
  createStripeCoupon,
  createStripePaymentIntent,
} from "../payments/stripe-api.js";
import type { StripeClient } from "../payments/stripe-client.js";
import type { CheckoutRow } from "./checkouts.table.js";
import { describeLine } from "./line-names.js";
import { toStripeAmount } from "../money/stripe-amounts.js";

/**
 * Asks Stripe to take the payment for a checkout. Lintel never sees card details:
 *
 *   - `hosted`: a Stripe Checkout page the shopper is sent to (the simplest, and the default);
 *   - `embedded`: a PaymentIntent the storefront confirms with Stripe's Payment Element,
 *     which collects the card inside an iframe served by Stripe.
 *
 * Both carry `lintel_checkout_id` in their metadata, which is how the webhook finds the
 * checkout again. Neither marks anything paid: only the signed webhook does that.
 */

export interface PaymentStarted {
  sessionId: string | null;
  paymentIntentId: string | null;
  url: string | null;
  clientSecret: string | null;
}

export interface PaymentPages {
  successUrl: string;
  cancelUrl: string;
}

export async function startHostedPayment(
  stripe: StripeClient,
  checkout: CheckoutRow,
  pages: PaymentPages,
): Promise<PaymentStarted> {
  const currency = checkout.currency.toLowerCase();
  const metadata = { lintel_checkout_id: checkout.id };
  const lineItems = checkout.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency,
      unit_amount: toStripeAmount(line.unitAmount, currency),
      product_data: {
        name: describeLine(line.productTitle, line.variantTitle),
      },
    },
  }));
  if (!checkout.taxesIncluded && checkout.taxAmount > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toStripeAmount(checkout.taxAmount, currency),
        product_data: { name: "Tax" },
      },
    });
  }
  const coupon =
    checkout.discountAmount > 0
      ? await createStripeCoupon(
          stripe,
          {
            amount: toStripeAmount(checkout.discountAmount, currency),
            currency,
            name: checkout.discounts.map((discount) => discount.title).join(", ") || "Discount",
          },
          `lintel-coupon-${checkout.id}`,
        )
      : null;

  const session = await createStripeCheckoutSession(
    stripe,
    {
      mode: "payment",
      client_reference_id: checkout.id,
      customer_email: checkout.email,
      success_url: pages.successUrl,
      cancel_url: pages.cancelUrl,
      expires_at: Math.floor(checkout.expiresAt.getTime() / 1000),
      metadata,
      payment_intent_data: { metadata },
      line_items: lineItems,
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: checkout.shippingLine.name,
            fixed_amount: {
              amount: toStripeAmount(checkout.shippingLine.amount, currency),
              currency,
            },
          },
        },
      ],
      discounts: coupon ? [{ coupon: coupon.id }] : undefined,
    },
    `lintel-checkout-${checkout.id}`,
  );
  return {
    sessionId: session.id,
    paymentIntentId: null,
    url: session.url ?? null,
    clientSecret: null,
  };
}

export async function startEmbeddedPayment(
  stripe: StripeClient,
  checkout: CheckoutRow,
): Promise<PaymentStarted> {
  const intent = await createStripePaymentIntent(
    stripe,
    {
      amount: toStripeAmount(checkout.totalAmount, checkout.currency),
      currency: checkout.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: checkout.email,
      metadata: { lintel_checkout_id: checkout.id },
    },
    `lintel-checkout-${checkout.id}`,
  );
  return {
    sessionId: null,
    paymentIntentId: intent.id,
    url: null,
    clientSecret: intent.client_secret ?? null,
  };
}
