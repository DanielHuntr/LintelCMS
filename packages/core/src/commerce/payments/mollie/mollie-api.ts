import { z } from "zod";
import type { CheckoutRow } from "../../checkouts/checkouts.table.js";
import type { PaymentPages } from "../payment-provider.js";
import { toDecimalAmount } from "../provider-amounts.js";
import type { MollieClient } from "./mollie-client.js";

/** The Mollie calls the shop makes, each with the parts of the answer Lintel reads. */

const amountSchema = z.object({ currency: z.string(), value: z.string() });

export const molliePaymentSchema = z.object({
  id: z.string(),
  status: z.string(),
  /** "test" for a payment made with a test key. */
  mode: z.string().nullish(),
  amount: amountSchema,
  metadata: z.record(z.string(), z.unknown()).nullish(),
  _links: z.object({ checkout: z.object({ href: z.string() }).nullish() }).nullish(),
});

export type MolliePayment = z.infer<typeof molliePaymentSchema>;

/**
 * A payment on Mollie's hosted page. `webhookUrl` is where Mollie says something changed;
 * Mollie only sends the payment's id there, and Lintel fetches the payment back to see
 * what really happened.
 */
export async function createMolliePayment(
  mollie: MollieClient,
  checkout: CheckoutRow,
  pages: PaymentPages,
  options: { webhookUrl: string | null; description: string },
) {
  const payment = await mollie.post(
    "/v2/payments",
    {
      amount: {
        currency: checkout.currency,
        value: toDecimalAmount(checkout.totalAmount, checkout.currency),
      },
      description: options.description.slice(0, 255),
      redirectUrl: pages.successUrl,
      cancelUrl: pages.cancelUrl,
      ...(options.webhookUrl && { webhookUrl: options.webhookUrl }),
      metadata: { lintel_checkout_id: checkout.id },
    },
    molliePaymentSchema,
    `lintel-checkout-${checkout.id}`,
  );
  return { id: payment.id, checkoutUrl: payment._links?.checkout?.href ?? null };
}

export function retrieveMolliePayment(mollie: MollieClient, paymentId: string) {
  return mollie.get(`/v2/payments/${encodeURIComponent(paymentId)}`, molliePaymentSchema);
}

export function cancelMolliePayment(mollie: MollieClient, paymentId: string) {
  return mollie.delete(`/v2/payments/${encodeURIComponent(paymentId)}`, z.unknown());
}

const refundSchema = z.object({ id: z.string(), status: z.string() });

export function createMollieRefund(
  mollie: MollieClient,
  parameters: { paymentId: string; amount: number; currency: string; refundId: string },
) {
  return mollie.post(
    `/v2/payments/${encodeURIComponent(parameters.paymentId)}/refunds`,
    {
      amount: {
        currency: parameters.currency,
        value: toDecimalAmount(parameters.amount, parameters.currency),
      },
      metadata: { lintel_refund_id: parameters.refundId },
    },
    refundSchema,
    `lintel-refund-${parameters.refundId}`,
  );
}

const refundListSchema = z.object({
  _embedded: z.object({ refunds: z.array(refundSchema) }).optional(),
});

export async function listMollieRefunds(mollie: MollieClient, paymentId: string) {
  const list = await mollie.get(
    `/v2/payments/${encodeURIComponent(paymentId)}/refunds`,
    refundListSchema,
  );
  return list._embedded?.refunds ?? [];
}

const methodsSchema = z.object({
  _embedded: z.object({ methods: z.array(z.object({ id: z.string(), description: z.string() })) }),
});

/** For "Check connection": the payment methods switched on for this key. */
export async function listMollieMethods(mollie: MollieClient) {
  return (await mollie.get("/v2/methods", methodsSchema))._embedded.methods;
}

export function mollieRefundStatus(status: string) {
  if (status === "refunded") return "succeeded" as const;
  if (status === "failed" || status === "canceled") return "failed" as const;
  return "pending" as const;
}
