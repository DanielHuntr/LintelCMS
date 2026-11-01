import type { ShopContext } from "../../commerce.context.js";
import { ShopNotReadyError } from "../../commerce.errors.js";
import { findSavedCredentials } from "../payment-accounts.repository.js";
import type { SavedPayPalCredentials } from "../payment-accounts.table.js";
import type { PaymentProvider } from "../payment-provider.js";
import { type PayPalCredentials, resolvePayPalCredentials } from "../provider-credentials.js";
import { createPayPalOrder, payPalRefundStatus, refundPayPalCapture } from "./paypal-api.js";
import { PayPalClient } from "./paypal-client.js";

/**
 * PayPal behind the PaymentProvider interface. The shopper approves the payment on PayPal's
 * own page; the money is captured when PayPal's verified webhook says it was approved, and
 * the order is placed when the capture's webhook arrives (see paypal-webhook.service.ts).
 */
export function payPalPaymentProvider(shop: ShopContext): PaymentProvider {
  return {
    id: "paypal",
    checkReady: async () => {
      await connectPayPal(shop);
    },
    needsPages: async () => true,
    async startPayment(checkout, pages) {
      if (!pages) throw new Error("PayPal always needs pages to send the shopper back to");
      const { client } = await connectPayPal(shop);
      const order = await createPayPalOrder(client, checkout, pages);
      return { url: order.approveUrl, clientSecret: null, saved: { providerPaymentId: order.id } };
    },
    // An approved order is only captured while its checkout is open, so nothing needs closing.
    closePayment: async () => {},
    async refundPayment(order, refund) {
      if (!order.providerPaymentId) throw new Error("A paid PayPal order always has its capture");
      const { client } = await connectPayPal(shop);
      const made = await refundPayPalCapture(client, {
        captureId: order.providerPaymentId,
        amount: refund.amount,
        currency: order.currency,
        refundId: refund.id,
      });
      return { reference: made.id, status: payPalRefundStatus(made.status) };
    },
  };
}

export async function findPayPalCredentials(shop: ShopContext): Promise<PayPalCredentials | null> {
  const saved = await findSavedCredentials(shop.database, "paypal");
  return resolvePayPalCredentials(saved as SavedPayPalCredentials | null, shop.environment);
}

export function payPalClientFor(
  shop: ShopContext,
  credentials: Pick<PayPalCredentials, "clientId" | "clientSecret" | "environment">,
): PayPalClient {
  return new PayPalClient({ ...credentials, fetch: shop.paymentFetch, apiUrl: shop.payPalApiUrl });
}

export async function connectPayPal(
  shop: ShopContext,
): Promise<{ client: PayPalClient; credentials: PayPalCredentials }> {
  const credentials = await findPayPalCredentials(shop);
  if (!credentials) {
    throw new ShopNotReadyError(
      "PayPal isn't connected yet. Connect it in Shop → Settings → Payments first.",
    );
  }
  return { client: payPalClientFor(shop, credentials), credentials };
}
