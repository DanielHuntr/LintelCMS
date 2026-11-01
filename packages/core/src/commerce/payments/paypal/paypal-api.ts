import { z } from "zod";
import type { CheckoutRow } from "../../checkouts/checkouts.table.js";
import { describeLine } from "../../checkouts/line-names.js";
import type { PaymentPages } from "../payment-provider.js";
import { toDecimalAmount } from "../provider-amounts.js";
import type { PayPalClient } from "./paypal-client.js";

/**
 * The PayPal calls the shop makes (Orders v2, Payments v2 and webhook verification), each
 * with the parts of the answer Lintel reads.
 */

const linkSchema = z.object({ href: z.string(), rel: z.string() });

const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  links: z.array(linkSchema).default([]),
  purchase_units: z
    .array(
      z.object({
        payments: z
          .object({
            captures: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/**
 * A PayPal order for the checkout, with every line, shipping, tax and discount spelled out
 * so PayPal's page shows what Lintel worked out. `custom_id` carries the checkout's id,
 * which is how the webhook finds it again.
 */
export async function createPayPalOrder(
  paypal: PayPalClient,
  checkout: CheckoutRow,
  pages: PaymentPages,
) {
  const currency = checkout.currency;
  const value = (amount: number) => ({
    currency_code: currency,
    value: toDecimalAmount(amount, currency),
  });
  const address = checkout.shippingAddress;
  const order = await paypal.post(
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: checkout.id,
          custom_id: checkout.id,
          amount: {
            ...value(checkout.totalAmount),
            breakdown: {
              item_total: value(checkout.subtotalAmount),
              shipping: value(checkout.shippingAmount),
              ...(checkout.discountAmount > 0 && { discount: value(checkout.discountAmount) }),
              ...(!checkout.taxesIncluded && { tax_total: value(checkout.taxAmount) }),
            },
          },
          items: checkout.lines.map((line) => ({
            name: describeLine(line.productTitle, line.variantTitle).slice(0, 127),
            quantity: String(line.quantity),
            unit_amount: value(line.unitAmount),
            ...(line.sku && { sku: line.sku.slice(0, 127) }),
          })),
          shipping: {
            name: { full_name: address.name.slice(0, 300) },
            address: {
              address_line_1: address.line1,
              ...(address.line2 && { address_line_2: address.line2 }),
              admin_area_2: address.city,
              ...(address.region && { admin_area_1: address.region }),
              postal_code: address.postalCode,
              country_code: address.country,
            },
          },
        },
      ],
      payment_source: {
        paypal: {
          email_address: checkout.email,
          experience_context: {
            return_url: pages.successUrl,
            cancel_url: pages.cancelUrl,
            user_action: "PAY_NOW",
            shipping_preference: "SET_PROVIDED_ADDRESS",
          },
        },
      },
    },
    orderSchema,
    `lintel-checkout-${checkout.id}`,
  );
  const approve = order.links.find((link) => link.rel === "payer-action" || link.rel === "approve");
  return { id: order.id, approveUrl: approve?.href ?? null };
}

/** Takes the money for an order the shopper approved on PayPal's page. Safe to repeat. */
export async function capturePayPalOrder(paypal: PayPalClient, orderId: string) {
  const order = await paypal.post(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {},
    orderSchema,
    `lintel-capture-${orderId}`,
  );
  return { id: order.id, status: order.status };
}

export interface PayPalTransmission {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

const verificationSchema = z.object({ verification_status: z.string() });

/**
 * Asks PayPal whether a webhook really came from it, for this shop's webhook: PayPal checks
 * the transmission signature against its certificate and the webhook id.
 */
export async function verifyPayPalWebhook(
  paypal: PayPalClient,
  transmission: PayPalTransmission,
  webhookId: string,
  event: unknown,
): Promise<boolean> {
  const result = await paypal.post(
    "/v1/notifications/verify-webhook-signature",
    {
      auth_algo: transmission.authAlgo,
      cert_url: transmission.certUrl,
      transmission_id: transmission.transmissionId,
      transmission_sig: transmission.transmissionSig,
      transmission_time: transmission.transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    },
    verificationSchema,
  );
  return result.verification_status === "SUCCESS";
}

const refundSchema = z.object({ id: z.string(), status: z.string() });

export function refundPayPalCapture(
  paypal: PayPalClient,
  parameters: { captureId: string; amount: number; currency: string; refundId: string },
) {
  return paypal.post(
    `/v2/payments/captures/${encodeURIComponent(parameters.captureId)}/refund`,
    {
      amount: {
        currency_code: parameters.currency,
        value: toDecimalAmount(parameters.amount, parameters.currency),
      },
      custom_id: parameters.refundId,
    },
    refundSchema,
    `lintel-refund-${parameters.refundId}`,
  );
}

const webhookSchema = z.object({ id: z.string(), url: z.string() });

/** For "Check connection": the webhook id names a webhook of this app. */
export function retrievePayPalWebhook(paypal: PayPalClient, webhookId: string) {
  return paypal.get(`/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, webhookSchema);
}

/** The webhook events to tick when adding the webhook in PayPal. */
export const PAYPAL_WEBHOOK_EVENTS = [
  "CHECKOUT.ORDER.APPROVED",
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REFUNDED",
] as const;

export const payPalEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  resource: z.record(z.string(), z.unknown()),
});

export const payPalOrderResourceSchema = z.object({
  id: z.string(),
  purchase_units: z.array(z.object({ custom_id: z.string().optional() })).default([]),
});

export const payPalCaptureResourceSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  custom_id: z.string().optional(),
  amount: z.object({ currency_code: z.string(), value: z.string() }),
  supplementary_data: z
    .object({ related_ids: z.object({ order_id: z.string().optional() }).optional() })
    .optional(),
});

export const payPalRefundResourceSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
});

export function payPalRefundStatus(status: string | undefined) {
  if (status === "COMPLETED") return "succeeded" as const;
  if (status === "FAILED" || status === "CANCELLED") return "failed" as const;
  return "pending" as const;
}
