import { z } from "zod";
import type { CheckoutRow } from "../../checkouts/checkouts.table.js";
import { describeLine } from "../../checkouts/line-names.js";
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
  /** The method the shopper chose on Mollie's page; empty until they choose. */
  method: z.string().nullish(),
  amount: amountSchema,
  metadata: z.record(z.string(), z.unknown()).nullish(),
  _links: z.object({ checkout: z.object({ href: z.string() }).nullish() }).nullish(),
});

export type MolliePayment = z.infer<typeof molliePaymentSchema>;

/**
 * A payment on Mollie's hosted page. `webhookUrl` is where Mollie says something changed;
 * Mollie only sends the payment's id there, and Lintel fetches the payment back to see
 * what really happened.
 *
 * Klarna, in3, Billie and vouchers need `lines` and the addresses, so every payment carries
 * them.
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
      lines: molliePaymentLines(checkout),
      billingAddress: mollieAddress(checkout),
      shippingAddress: mollieAddress(checkout),
      ...(options.webhookUrl && { webhookUrl: options.webhookUrl }),
      metadata: { lintel_checkout_id: checkout.id },
    },
    molliePaymentSchema,
    `lintel-checkout-${checkout.id}`,
  );
  return { id: payment.id, checkoutUrl: payment._links?.checkout?.href ?? null };
}

/**
 * What was bought, as Mollie wants it: the lines' totals must add up to the payment exactly,
 * so these follow `checkoutTotals`, with discounts, delivery and any tax on top as lines.
 */
function molliePaymentLines(checkout: CheckoutRow) {
  const money = (amount: number) => ({
    currency: checkout.currency,
    value: toDecimalAmount(amount, checkout.currency),
  });
  const extra = (type: string, description: string, amount: number) => ({
    type,
    description: description.slice(0, 100),
    quantity: 1,
    unitPrice: money(amount),
    totalAmount: money(amount),
  });
  const discounts = checkout.discounts.map((discount) => discount.title).join(", ");
  return [
    ...checkout.lines.map((line) => ({
      description: describeLine(line.productTitle, line.variantTitle).slice(0, 100),
      quantity: line.quantity,
      unitPrice: money(line.unitAmount),
      totalAmount: money(line.subtotalAmount),
      ...(line.sku && { sku: line.sku.slice(0, 64) }),
    })),
    ...(checkout.discountAmount > 0
      ? [extra("discount", discounts || "Discount", -checkout.discountAmount)]
      : []),
    ...(checkout.shippingAmount > 0
      ? [extra("shipping_fee", checkout.shippingLine.name, checkout.shippingAmount)]
      : []),
    ...(!checkout.taxesIncluded && checkout.taxAmount > 0
      ? [extra("surcharge", "Tax", checkout.taxAmount)]
      : []),
  ];
}

/**
 * The delivery address, which is also the billing address: the shop asks for only one.
 * Mollie wants the name in two parts, and a postal address with every part, so one without a
 * postcode is left out and the email stands in for it.
 */
function mollieAddress(checkout: CheckoutRow) {
  const address = checkout.shippingAddress;
  const names = address.name.split(/\s+/);
  const familyName = names.at(-1) ?? address.name;
  return {
    givenName: names.length > 1 ? names.slice(0, -1).join(" ") : familyName,
    familyName,
    email: checkout.email,
    ...(address.company && { organizationName: address.company }),
    ...(address.postalCode && {
      streetAndNumber: address.line1,
      ...(address.line2 && { streetAdditional: address.line2 }),
      postalCode: address.postalCode,
      city: address.city,
      ...(address.region && { region: address.region }),
      country: address.country,
    }),
  };
}

export function retrieveMolliePayment(mollie: MollieClient, paymentId: string) {
  return mollie.get(`/v2/payments/${encodeURIComponent(paymentId)}`, molliePaymentSchema);
}

/** Takes the money for a payment the shopper authorised, such as Klarna. Safe to repeat. */
export function captureMolliePayment(mollie: MollieClient, paymentId: string) {
  return mollie.post(
    `/v2/payments/${encodeURIComponent(paymentId)}/captures`,
    {},
    z.object({ id: z.string() }),
    `lintel-capture-${paymentId}`,
  );
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
  _embedded: z.object({
    methods: z.array(
      z.object({ id: z.string(), description: z.string(), status: z.string().nullish() }),
    ),
  }),
});

/**
 * The payment methods switched on for this key. Without an amount Mollie lists only the
 * ones that work in euros; with one, those that can take that amount in that currency.
 */
export async function listMollieMethods(
  mollie: MollieClient,
  amount?: { currency: string; value: string },
) {
  const query = amount
    ? `?${new URLSearchParams({ "amount[value]": amount.value, "amount[currency]": amount.currency })}`
    : "";
  return (await mollie.get(`/v2/methods${query}`, methodsSchema))._embedded.methods;
}

export function mollieRefundStatus(status: string) {
  if (status === "refunded") return "succeeded" as const;
  if (status === "failed" || status === "canceled") return "failed" as const;
  return "pending" as const;
}
