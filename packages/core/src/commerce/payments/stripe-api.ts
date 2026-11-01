import { z } from "zod";
import type { StripeClient, StripeParameters } from "./stripe-client.js";

/**
 * The Stripe calls the shop makes, each with the shape of the answer it relies on. Only the
 * fields Lintel reads are listed; Stripe sends many more.
 */

const accountSchema = z.object({
  id: z.string(),
  email: z.string().nullish(),
  business_profile: z.object({ name: z.string().nullish() }).nullish(),
  settings: z
    .object({ dashboard: z.object({ display_name: z.string().nullish() }).nullish() })
    .nullish(),
});

export async function retrieveStripeAccount(stripe: StripeClient) {
  const account = await stripe.get("/v1/account", accountSchema);
  return {
    id: account.id,
    name:
      account.settings?.dashboard?.display_name ??
      account.business_profile?.name ??
      account.email ??
      account.id,
  };
}

const checkoutSessionSchema = z.object({
  id: z.string(),
  url: z.string().nullish(),
  expires_at: z.number().optional(),
});

/** A Stripe-hosted payment page. See checkouts/stripe-payment.ts for the parameters. */
export function createStripeCheckoutSession(
  stripe: StripeClient,
  parameters: StripeParameters,
  idempotencyKey: string,
) {
  return stripe.post("/v1/checkout/sessions", parameters, checkoutSessionSchema, idempotencyKey);
}

/** Closes a payment page nobody will use, such as when the shopper starts again. */
export function expireStripeCheckoutSession(stripe: StripeClient, sessionId: string) {
  return stripe.post(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
    {},
    checkoutSessionSchema,
  );
}

const paymentIntentSchema = z.object({
  id: z.string(),
  client_secret: z.string().nullish(),
});

/** For the Payment Element: the storefront confirms it with Stripe.js. */
export function createStripePaymentIntent(
  stripe: StripeClient,
  parameters: StripeParameters,
  idempotencyKey: string,
) {
  return stripe.post("/v1/payment_intents", parameters, paymentIntentSchema, idempotencyKey);
}

export function cancelStripePaymentIntent(stripe: StripeClient, paymentIntentId: string) {
  return stripe.post(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
    {},
    paymentIntentSchema,
  );
}

export const stripeRefundSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string().nullish(),
  payment_intent: z.string().nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
});

export type StripeRefund = z.infer<typeof stripeRefundSchema>;

export function createStripeRefund(
  stripe: StripeClient,
  parameters: { paymentIntentId: string; amount: number; orderId: string; refundId: string },
) {
  return stripe.post(
    "/v1/refunds",
    {
      payment_intent: parameters.paymentIntentId,
      amount: parameters.amount,
      metadata: { lintel_order_id: parameters.orderId, lintel_refund_id: parameters.refundId },
    },
    stripeRefundSchema,
    `lintel-refund-${parameters.refundId}`,
  );
}

const taxCalculationSchema = z.object({
  id: z.string().nullish(),
  tax_amount_exclusive: z.number().int(),
  tax_amount_inclusive: z.number().int(),
  line_items: z
    .object({
      data: z.array(z.object({ reference: z.string().nullish(), amount_tax: z.number().int() })),
    })
    .nullish(),
  shipping_cost: z.object({ amount_tax: z.number().int() }).nullish(),
});

export type StripeTaxCalculation = z.infer<typeof taxCalculationSchema>;

/** Stripe Tax works out the tax; see taxes/stripe-tax-provider.ts. */
export function createStripeTaxCalculation(
  stripe: StripeClient,
  parameters: StripeParameters,
  idempotencyKey: string,
) {
  return stripe.post("/v1/tax/calculations", parameters, taxCalculationSchema, idempotencyKey);
}

const taxTransactionSchema = z.object({ id: z.string() });

/** Records a paid order's tax with Stripe, so it shows in Stripe Tax's reports. */
export function createStripeTaxTransaction(
  stripe: StripeClient,
  calculationId: string,
  reference: string,
) {
  return stripe.post(
    "/v1/tax/transactions/create_from_calculation",
    { calculation: calculationId, reference },
    taxTransactionSchema,
    `lintel-tax-${calculationId}`,
  );
}

const couponSchema = z.object({ id: z.string() });

/**
 * A one-off amount off, for a hosted checkout with discounts: Stripe's payment page only
 * takes discounts as coupons. Used once and never again.
 */
export function createStripeCoupon(
  stripe: StripeClient,
  parameters: { amount: number; currency: string; name: string },
  idempotencyKey: string,
) {
  return stripe.post(
    "/v1/coupons",
    {
      amount_off: parameters.amount,
      currency: parameters.currency.toLowerCase(),
      duration: "once",
      max_redemptions: 1,
      name: parameters.name.slice(0, 40),
    },
    couponSchema,
    idempotencyKey,
  );
}
