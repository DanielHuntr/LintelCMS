import { z } from "zod";

/**
 * The Stripe events the shop listens to. The admin lists these in the "Connect Stripe"
 * steps, for ticking when the webhook endpoint is added in Stripe.
 *
 *   checkout.session.completed / async_payment_succeeded   hosted checkout was paid
 *   checkout.session.async_payment_failed                   a delayed payment didn't arrive
 *   checkout.session.expired                                hosted checkout abandoned
 *   payment_intent.succeeded                                paid (Payment Element, or hosted)
 *   payment_intent.canceled                                 embedded payment given up
 *   refund.created / refund.updated                         refunds, including ones made in Stripe
 */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.canceled",
  "refund.created",
  "refund.updated",
] as const;

export const stripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  /** When it happened, in seconds since 1970. */
  created: z.number().optional(),
  livemode: z.boolean().optional(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

export type StripeEvent = z.infer<typeof stripeEventSchema>;

const metadataSchema = z.record(z.string(), z.string()).nullish();

export const stripeCheckoutSessionObjectSchema = z.object({
  id: z.string(),
  livemode: z.boolean().nullish(),
  payment_status: z.string().nullish(),
  amount_total: z.number().int().nullish(),
  currency: z.string().nullish(),
  payment_intent: z.string().nullish(),
  client_reference_id: z.string().nullish(),
  metadata: metadataSchema,
});

export const stripePaymentIntentObjectSchema = z.object({
  id: z.string(),
  livemode: z.boolean().nullish(),
  status: z.string().nullish(),
  amount_received: z.number().int().nullish(),
  currency: z.string().nullish(),
  metadata: metadataSchema,
});
